import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/password';

const socialLoginSchema = z.object({
  provider: z.enum(['google', 'facebook', 'apple']),
  providerId: z.string().min(1, 'ID del proveedor es requerido'),
  email: z.string().email('Email inválido'),
  name: z.string().optional(),
  avatarUrl: z.string().url().optional()
});

const registerSchema = z.object({
  email: z.string().email('Por favor ingresa un correo electrónico válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres para ser segura'),
  name: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email('Por favor ingresa un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es requerida')
});

/**
 * Registro de cuenta con correo electrónico y contraseña segura.
 */
export async function registerWithEmail(req: Request, res: Response) {
  try {
    const validated = registerSchema.parse(req.body);
    const { email, password, name } = validated;
    const cleanEmail = email.toLowerCase().trim();

    // 1. Verificar si el correo ya está registrado
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Este correo electrónico ya está registrado. Por favor inicia sesión.'
      });
    }

    // 2. Generar nombre de usuario único y hash seguro de la contraseña
    const username = await generateUniqueUsername(name || cleanEmail);
    const passwordHash = hashPassword(password);

    // 3. Crear el nuevo usuario
    const newUser = await prisma.user.create({
      data: {
        email: cleanEmail,
        username,
        passwordHash,
        name: name?.trim() || username,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(username)}`,
        authProvider: 'email',
        reputation: 50 // Bonificación de bienvenida
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Cuenta creada exitosamente',
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          name: newUser.name,
          avatarUrl: newUser.avatarUrl,
          reputation: newUser.reputation,
          authProvider: newUser.authProvider,
          createdAt: newUser.createdAt
        }
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Datos de registro inválidos',
        errors: error.errors
      });
    }

    console.error('Error en registro con correo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al crear la cuenta'
    });
  }
}

/**
 * Inicio de sesión con correo electrónico y contraseña.
 */
export async function loginWithEmail(req: Request, res: Response) {
  try {
    const validated = loginSchema.parse(req.body);
    const { email, password } = validated;
    const cleanEmail = email.toLowerCase().trim();

    // 1. Buscar usuario por correo
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas. Verifica tu correo o contraseña.'
      });
    }

    // 2. Si el usuario se registró vía red social y no tiene contraseña local
    if (!user.passwordHash) {
      const providerName = user.authProvider ? user.authProvider.toUpperCase() : 'OAuth';
      return res.status(400).json({
        success: false,
        message: `Esta cuenta fue creada usando ${providerName}. Por favor inicia sesión con el botón de ${providerName}.`
      });
    }

    // 3. Comprobar la contraseña con el hash seguro
    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas. Verifica tu correo o contraseña.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Sesión iniciada con éxito',
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
          reputation: user.reputation,
          authProvider: user.authProvider,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Datos de inicio de sesión inválidos',
        errors: error.errors
      });
    }

    console.error('Error en login con correo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor durante el inicio de sesión'
    });
  }
}

/**
 * Genera un username único a partir del email o nombre
 */
async function generateUniqueUsername(base: string): Promise<string> {
  let clean = base.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  if (clean.length < 3) clean = 'cazador';
  let candidate = clean;
  let counter = 1;

  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${clean}_${Math.floor(100 + Math.random() * 900)}`;
    counter++;
    if (counter > 10) {
      candidate = `${clean}_${Date.now().toString().slice(-4)}`;
      break;
    }
  }

  return candidate;
}

/**
 * Autenticación social con Google, Facebook o Apple.
 * Si el usuario ya existe, actualiza sus datos; si es nuevo, crea su cuenta.
 */
export async function socialLogin(req: Request, res: Response) {
  try {
    const validated = socialLoginSchema.parse(req.body);
    const { provider, providerId, email, name, avatarUrl } = validated;

    // 1. Buscar si ya existe por email o por providerId
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { providerId, authProvider: provider }
        ]
      }
    });

    if (user) {
      // Actualizar datos si cambiaron
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: name || user.name,
          avatarUrl: avatarUrl || user.avatarUrl,
          authProvider: provider,
          providerId
        }
      });
    } else {
      // Crear nuevo usuario
      const username = await generateUniqueUsername(name || email);
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          username,
          name: name || username,
          avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(username)}`,
          authProvider: provider,
          providerId,
          reputation: 50 // Bonificación de bienvenida
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: `Sesión iniciada con éxito mediante ${provider}`,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
          reputation: user.reputation,
          authProvider: user.authProvider,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Datos de inicio de sesión inválidos',
        errors: error.errors
      });
    }

    console.error('Error en social login:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor durante la autenticación'
    });
  }
}

/**
 * Obtener perfil y estadísticas del cazador de ofertas
 */
export async function getUserProfile(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            priceEntries: true,
            votes: true
          }
        },
        priceEntries: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            product: { select: { name: true, barcode: true } },
            store: { select: { name: true, branch: true } }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    let rank = 'Cazador Novato';
    if (user.reputation >= 500) rank = 'Leyenda de las Liquidaciones';
    else if (user.reputation >= 200) rank = 'Cazador Experto';
    else if (user.reputation >= 100) rank = 'Cazador Pro';

    return res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
        reputation: user.reputation,
        authProvider: user.authProvider,
        rank,
        stats: {
          totalDealsReported: user._count.priceEntries,
          totalCommunityVotes: user._count.votes
        },
        recentDeals: user.priceEntries
      }
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al consultar el perfil'
    });
  }
}
