
import { createHmac, timingSafeEqual } from 'crypto'

export type PaymentProvider = 'MTN' | 'MOOV'

interface PaymentRequest {
    amount: number
    phoneNumber: string
    provider: PaymentProvider
    contractId: string
}

interface PaymentResponse {
    transactionId: string
    status: 'PENDING' | 'FAILED'
    message: string
}

// Mock function to simulate API call to MTN/Moov
export async function requestPayment({ amount, phoneNumber, provider, contractId }: PaymentRequest): Promise<PaymentResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Basic validation
    if (!Number.isFinite(amount) || amount <= 0) {
        return {
            transactionId: '',
            status: 'FAILED',
            message: 'Invalid amount'
        }
    }

    if (!phoneNumber.match(/^[0-9]{8,15}$/)) {
        return {
            transactionId: '',
            status: 'FAILED',
            message: 'Invalid phone number'
        }
    }

    // Simulate transaction ID generation
    const transactionId = `${provider}-${contractId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    // In a real scenario, we would save the transaction state as PENDING and wait for Webhook
    // Here we just return the ID. usage of this function should save to DB.

    return {
        transactionId,
        status: 'PENDING',
        message: 'Payment initiated successfully. Please approve on your phone.'
    }
}

export function verifyWebhookSignature(signature: string, body: string, secret: string): boolean {
    const expected = createHmac('sha256', secret).update(body).digest('hex')
    const expectedBuffer = Buffer.from(expected)
    const signatureBuffer = Buffer.from(signature)

    if (expectedBuffer.length !== signatureBuffer.length) {
        return false
    }

    return timingSafeEqual(expectedBuffer, signatureBuffer)
}
