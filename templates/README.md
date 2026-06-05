# Modeles Word — Benin

## Contrat de bail d'habitation

Le fichier `contrat-location.docx` reprend le modele legal **CONTRAT DE BAIL D'HABITATION** (Republique du Benin, Loi n° 2013-01).

Regenerer apres modification du texte :

```bash
npm run templates:generate
```

## Champs remplis automatiquement

| Balise | Source application |
|--------|-------------------|
| `{bailleurNom}`, `{bailleurEmail}`, `{bailleurTelephone}` | Compte manager |
| `{locataireNom}`, `{locataireEmail}`, `{locataireTelephone}` | Locataire du contrat |
| `{bienAdresse}`, `{bienTitre}`, `{bienType}` | Fiche bien |
| `{dateEffet}`, `{dateFin}`, `{dureeMois}` | Dates du contrat |
| `{loyerMontant}`, `{cautionMontant}`, `{cautionMois}` | Montants du bail |
| `{modePaiement}` | Parametres paiement manager (MoMo) |
| `{clauses}` | Conditions de bail (parametres) |
| `{contractNumber}` | Numero de contrat |
| `{lieuSignature}`, `{dateSignature}` | Ville du bien + date du jour |

## Champs a completer manuellement (Word)

Ces champs affichent **A completer** tant qu'ils ne sont pas saisis dans l'application :

- `{bailleurNaissance}`, `{bailleurNationalite}`, `{bailleurProfession}`, `{bailleurPieceIdentite}`
- `{locataireNaissance}`, `{locataireNationalite}`, `{locataireProfession}`, `{locatairePieceIdentite}`
- `{bienPieces}`, `{bienSurface}`, `{bienEtage}`

Vous pouvez les modifier directement dans le `.docx` telecharge.

## Telechargement

- Word : `/api/contracts/[id]/download?format=docx`
- PDF : `/api/contracts/[id]/download`

## Quittance

Fichier `quittance-loyer.docx` — voir balises `{receiptNumber}`, `{tenantName}`, `{amount}`, etc.
