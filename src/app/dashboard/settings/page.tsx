import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Profil Utilisateur</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="email">Email</Label>
                        <Input type="email" id="email" placeholder="Email" disabled />
                    </div>
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="name">Nom Complet</Label>
                        <Input type="text" id="name" placeholder="Nom" />
                    </div>
                    <Button>Sauvegarder</Button>
                </CardContent>
            </Card>
        </div>
    )
}
