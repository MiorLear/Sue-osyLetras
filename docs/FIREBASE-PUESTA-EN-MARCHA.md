# Firebase: puesta en marcha de producción

Este documento convierte `DESPLIEGUE.md` en una lista ejecutable para el proyecto real.
No sustituye el runbook técnico: fija los identificadores ya decididos y evita pasos ambiguos.

## Estado comprobado

| Recurso | Estado |
|---|---|
| Proyecto | `explorarte-6335b` (número `75000728943`) |
| Facturación | Blaze activo |
| Hosting | creado: `https://explorarte-6335b.web.app` |
| Alias versionado | `web/.firebaserc` |
| Configuración Hosting/PWA | `web/firebase.json` |
| Cloud SDK local | instalado (la terminal debe reiniciarse para refrescar PATH) |
| Sesión de Cloud SDK | activa: `miguelledezma005@gmail.com` |
| Cloud SQL | `explorarte-6335b-instance`, PostgreSQL 18, `us-east4` |
| Respaldo SQL | automático a las `08:00 UTC`, PITR 7 días y protección contra borrado |
| Base de aplicación | `explorarte` |
| Bucket privado | `gs://explorarte-6335b-media` |
| Secret Manager | `JWT_SECRET` y `DB_PASSWORD` creados; Cloud Run consume `latest` |
| Cloud Run | `explorarte-api`, activo en `us-east4` |
| Web App de Firebase | no necesaria: la PWA no usa el SDK cliente de Firebase |

## Decisiones ya tomadas

- Firebase Hosting sirve el build estático de `web/dist`.
- La PWA usa `VITE_API_URL=/api` en producción.
- Hosting reenvía `/api/**` y `/media/**` a Cloud Run `explorarte-api` en `us-east4`, junto a Cloud SQL.
- Firebase conserva la ruta original; `ApiPrefixFilter` elimina `/api` antes de Spring MVC.
- No se versionan llaves JSON. GitHub Actions usa Workload Identity Federation.

## Orden seguro del primer despliegue

No publiques Hosting antes de Cloud Run: Firebase rechaza una configuración que apunta a un
servicio inexistente.

1. Instalar [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) y abrir una terminal nueva.
2. Autenticar y fijar el proyecto:

   ```powershell
   gcloud auth login
   gcloud config set project explorarte-6335b
   gcloud config set run/region us-east4
   ```

3. Ejecutar el diagnóstico versionado:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/firebase-preflight.ps1
   ```

4. Crear o verificar Cloud SQL, el bucket, Secret Manager y Cloud Run siguiendo las secciones
   3–6 de `DESPLIEGUE.md`, usando siempre `explorarte-6335b`.
5. Confirmar que responde directamente Cloud Run y después a través de Hosting:

   ```powershell
   curl.exe -f https://explorarte-6335b.web.app/api/actuator/health
   ```

6. Publicar Hosting desde una máquina autorizada:

   ```powershell
   npm --prefix shared run build
   npm --prefix web run firebase:deploy
   ```

## Automatización de GitHub

El workflow `Deploy Firebase Hosting` es manual y usa el environment `production`. La identidad
federada restringida a `MiorLear/Sue-osyLetras` y estas variables ya están configuradas:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`

El service account `github-firebase-deploy@explorarte-6335b.iam.gserviceaccount.com` solo tiene los
permisos necesarios para publicar Firebase Hosting. No guardar un service-account JSON como secret
permanente. El deploy se lanza desde Actions → Deploy Firebase Hosting → Run workflow.

## Facturación

Blaze ya está activo. Firebase Hosting suele ser despreciable para este volumen; Cloud Run puede
quedar cerca de cero con `min-instances=0`. Cloud SQL es el costo fijo principal. Antes de crearlo:

- configurar un presupuesto y alertas en Google Cloud Billing;
- comenzar con la instancia más pequeña compatible;
- conservar los backups automáticos y PITR de 7 días ya habilitados;
- no activar `min-instances=1` en Cloud Run hasta medir una necesidad real.

## Lo que nunca se versiona

- `JWT_SECRET`;
- contraseña de Cloud SQL;
- `RESEND_API_KEY`;
- llaves JSON de service accounts;
- dumps de la base de datos.

Todos esos valores van en Secret Manager. `DATABASE_URL` no debe existir en Cloud Run porque
tiene precedencia sobre la conexión de Cloud SQL usada por producción.
