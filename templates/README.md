# Modeles Word (contrats et quittances)

Ces fichiers `.docx` sont remplis automatiquement via **docxtemplater**.

## Fichiers

| Fichier | Usage |
|---------|--------|
| `contrat-location.docx` | Bail / location |
| `contrat-vente.docx` | Vente immobiliere |
| `quittance-loyer.docx` | Quittance apres paiement |

## Regenerer les modeles par defaut

```bash
node scripts/generate-word-templates.mjs
```

## Personnaliser vos propres modeles Word

1. Ouvrez un fichier `.docx` dans Word.
2. Inserez les balises **exactement** comme ci-dessous (accolades incluses).
3. Enregistrez dans ce dossier `templates/` (meme nom de fichier).

### Contrat de location / vente

- `{contractNumber}` — numero de contrat
- `{documentDate}` — date du jour
- `{ownerName}`, `{ownerEmail}`, `{ownerPhone}`
- `{tenantName}`, `{tenantEmail}`, `{tenantPhone}`
- `{propertyTitle}`, `{propertyAddress}`, `{propertyCity}`, `{propertyType}`
- `{startDate}`, `{endDate}`
- `{rentAmount}`, `{depositAmount}` (formates)
- `{clauses}` — conditions / texte libre
- `{ownerSignatureDate}`, `{tenantSignatureDate}`

### Quittance

- `{receiptNumber}`, `{contractNumber}`, `{paymentDate}`
- `{tenantName}`, `{ownerName}`
- `{propertyTitle}`, `{propertyAddress}`
- `{amount}`, `{method}`, `{transactionId}`
- `{receiptMentions}`, `{documentDate}`

## Telechargement dans l'application

- Contrat Word : `/api/contracts/[id]/download?format=docx`
- Quittance Word : `/api/payments/[id]/receipt?format=docx`
- Bouton **Remplir depuis modele Word** sur la fiche contrat (manager)
