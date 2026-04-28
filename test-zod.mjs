import { z } from 'zod'

const createPropertySchema = z.object({
    title: z.string().trim().min(2).max(150),
    city: z.preprocess(
        (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
        z.string().trim().min(2).max(120).optional()
    ),
    address: z.string().trim().min(5).max(255),
    price: z.coerce.number().positive(),
    description: z.string().trim().max(2000).optional(),
    status: z.string().optional(),
    propertyType: z.string().optional(),
    offerType: z.string().optional(),
    isPublished: z.coerce.boolean().optional(),
    imageUrls: z.array(z.string().trim().min(5)).optional(),
})

try {
    // Mock data removed to satisfy ESLint
    
    // Simulate what happens with formData returning File objects or empty strings
    const formDataEntries = {
        title: "Villa meublé",
        city: "Cotonou",
        address: "Haie vive",
        price: "15000000",
        description: "", // Textarea might be empty string
        propertyType: "HOUSE",
        offerType: "SALE",
        status: null, // Select without default could be null or empty
        image: {}, // File object
        imageUrls: ""
    }
    
    const parsedData = {
        title: formDataEntries.title ?? undefined,
        city: formDataEntries.city ?? undefined,
        address: formDataEntries.address ?? undefined,
        price: formDataEntries.price ?? undefined,
        description: formDataEntries.description ?? undefined,
        propertyType: formDataEntries.propertyType ?? undefined,
        offerType: formDataEntries.offerType ?? undefined,
        status: formDataEntries.status ?? undefined,
        isPublished: false,
        imageUrls: []
    }

    createPropertySchema.parse(parsedData)
    console.log("Validation passed!")
} catch (error) {
    if (error instanceof z.ZodError) {
        console.error("Zod Error:", JSON.stringify(error.issues, null, 2))
    } else {
        console.error("Other Error:", error)
    }
}
