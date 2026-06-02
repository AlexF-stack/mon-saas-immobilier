import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for the request body
const PropertyCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  city: z.string().optional(),
  address: z.string(),
  price: z.number().positive(),
  offerType: z.enum(['RENT', 'SALE']).optional().default('RENT'),
  propertyType: z.enum(['APARTMENT', 'HOUSE', 'STUDIO', 'COMMERCIAL', 'LAND']).optional().default('APARTMENT'),
  status: z.enum(['AVAILABLE', 'RENTED', 'MAINTENANCE']).optional().default('AVAILABLE'),
  // tableau d'URL d'images déjà uploadées (minimum 3)
  images: z.array(z.string().url()).min(3, { message: 'Chaque bien doit contenir au moins trois images.' }),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const data = PropertyCreateSchema.parse(json);

    // Création du bien avec les images liées
    const property = await prisma.property.create({
      data: {
        title: data.title,
        description: data.description,
        city: data.city,
        address: data.address,
        price: data.price,
        offerType: data.offerType,
        propertyType: data.propertyType,
        status: data.status,
        images: {
          create: data.images.map((url) => ({ url })),
        },
      },
      include: { images: true },
    });

    return NextResponse.json({ property }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors.map((e) => e.message) }, { status: 400 });
    }
    console.error('Error creating property:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
