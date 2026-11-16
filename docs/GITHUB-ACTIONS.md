# Desplegar Veterinaria V4 desde GitHub Actions

El repositorio GitHub es la fuente del código. CloudShell se utiliza una vez para crear el bucket de estado y una identidad IAM dedicada. GitHub Actions construye las imágenes, aplica Terraform, prueba la API y destruye la infraestructura cuando lo solicitas. No se sube el ZIP a CloudShell ni se depende de que una sesión de terminal permanezca abierta.

## Archivos para aplicar al repositorio

Descomprimir `Cambios_GitHub_Actions_Veterinaria.zip` SOBRE la raíz de tu repositorio local V4. Dentro de esa raíz deben estar `package.json`, `Dockerfile`, `terraform`, `scripts` y `.github`. El paquete contiene sólo archivos añadidos o actualizados; no reemplaza tus entidades ni la aplicación. Aceptar la sustitución de los archivos indicados en `MANIFIESTO-CAMBIOS.txt`.

Nuevos workflows: `AWS V4 Deploy` y `AWS V4 Destroy`. Se conserva `V4 Chaos quality gate`. Los tres usan el mismo grupo de concurrencia para no ejecutar un destroy durante un despliegue o un experimento. La exclusión opera sólo dentro de este repositorio.

Desde la terminal de tu proyecto local:

```bash
git status
git branch --show-current
git add .github/workflows scripts/bootstrap-github.sh scripts/deploy-v4.sh scripts/verify-aws-v4.py tests-v4/test_deployment_scripts.py docs/GITHUB-ACTIONS.md MANIFIESTO-CAMBIOS.txt
git commit -m "🚀 feat: automatizar despliegue y destruccion de Veterinaria V4"
git push
```

Los workflows deben llegar a la rama predeterminada del repositorio (normalmente main). Si trabajas en otra rama, fusionarla primero. Deploy y Destroy están limitados a esa rama. Se ejecutan manualmente para no levantar recursos facturables cada vez que edites documentación; las pruebas locales sí corren en push y pull request.

## Preparación única en AWS CloudShell

Seleccionar Ohio `us-east-2` y abrir CloudShell. No necesitas Terraform ni Docker en esta fase y no se despliega la API desde esta consola.

```bash
export AWS_REGION=us-east-2
export AWS_DEFAULT_REGION=us-east-2
export AWS_PAGER=""
aws sts get-caller-identity
```

Comprobar el número de cuenta. Clonar la rama predeterminada que ya contiene los nuevos archivos:

```bash
cd "$HOME"
read -rp 'URL HTTPS de tu repositorio GitHub: ' REPO_URL
git clone "$REPO_URL" veterinaria-bootstrap
cd veterinaria-bootstrap
bash scripts/bootstrap-github.sh
```

Si ya existe esa carpeta de un intento anterior, entrar en ella y ejecutar `git pull --ff-only` en lugar de volver a clonarla. Si el repositorio es privado, autenticar Git con un método autorizado de GitHub; una contraseña de la cuenta GitHub no sirve como contraseña Git. No escribir un token en la URL del repositorio.

El script hace lo siguiente:

1. Crea o reutiliza `veterinaria-tfstate-NUMERO_CUENTA-us-east-2`, activa versionado y cifrado y bloquea acceso público. Si ya usaste otro bucket para ESTE estado, exporta `TF_STATE_BUCKET` con ese nombre antes de ejecutar el script; no abras un segundo estado para la misma infraestructura.
2. Crea el usuario IAM `veterinaria-github-v4`, sin contraseña de consola.
3. Crea y asocia `VeterinariaGitHubV4Deployment`, una política de laboratorio que permite administrar EC2/red, ECS, ALB, RDS, ECR, logs y secretos en us-east-2, además de CloudFront. S3 se limita al bucket/prefijo del estado y la administración IAM al rol ECS del proyecto. No es AdministratorAccess, pero los permisos sobre los servicios regionales son amplios; usar esta identidad sólo en la cuenta de laboratorio.
4. Crea una access key, guardándola fuera del repositorio en `~/veterinaria-github-bootstrap/access-key.json`, con permisos de archivo 600. No imprime sus secretos automáticamente.
5. Genera el token de caos si no existe. Si conservas el token de los pasos anteriores en `~/veterinaria-config/chaos-token`, lo reutiliza. Si tu compañera ya usa otro token acordado, debes usar ese mismo valor en GitHub y ambas APIs.

Esta vía usa un usuario IAM porque anteriormente la organización bloqueó el proveedor OIDC. No intenta cambiar ni evadir SCP. Si aparece AccessDenied para CreateUser, CreateAccessKey o las políticas, detenerse y solicitar al administrador una identidad de despliegue autorizada. Las credenciales no anulan las restricciones de la organización.

Al terminar se muestran `AWS_ACCOUNT_ID` y `TF_STATE_BUCKET`. Guardar ambos valores.

## Configurar GitHub

Ir al repositorio → Settings → Secrets and variables → Actions.

En Secrets crear:

| Nombre | Origen |
|---|---|
| AWS_ACCESS_KEY_ID | AccessKeyId del archivo generado |
| AWS_SECRET_ACCESS_KEY | SecretAccessKey del archivo generado |
| CHAOS_TOKEN | Token compartido con la API GCP, mínimo 32 caracteres |

Para ver los valores en TU consola y copiarlos directamente a GitHub:

```bash
python3 - <<'PY'
import json,pathlib
key=json.loads((pathlib.Path.home()/'veterinaria-github-bootstrap/access-key.json').read_text())['AccessKey']
print('AWS_ACCESS_KEY_ID:',key['AccessKeyId'])
print('AWS_SECRET_ACCESS_KEY:',key['SecretAccessKey'])
PY
cat "$HOME/veterinaria-github-bootstrap/chaos-token"
```

No compartir esos valores por chat, capturas ni commits. No crear `AWS_SESSION_TOKEN`: estas son credenciales del usuario dedicado, no las credenciales temporales de tu sesión de CloudShell. El archivo local no es necesario para ejecutar Actions una vez copiados los secretos; puede eliminarse si ya los guardaste correctamente. La clave secreta no se puede recuperar de AWS después, sólo rotar.

En Variables crear:

| Nombre | Valor |
|---|---|
| AWS_ACCOUNT_ID | Número de cuenta de 12 dígitos mostrado por el script |
| TF_STATE_BUCKET | Nombre del bucket mostrado por el script |
| GCP_API_URL | Opcional inicialmente; URL base de la API de juegos, sin /juegos/raw |
| CHAOS_BASE_URL | Se configura después del primer despliegue con la URL de Veterinaria |

`TF_STATE_BUCKET` es VARIABLE, no secret. Si lo guardaste únicamente como secret, el workflow no lo encontrará. Inicialmente puedes omitir `GCP_API_URL` y `CHAOS_BASE_URL` hasta tener las URLs.

No necesitas un PAT de GitHub dentro del pipeline, un secreto con contraseña de PostgreSQL ni AWS CLI configurado en tu computador. Terraform genera la contraseña de RDS y la aplicación la recibe desde Secrets Manager.

## Primer despliegue

Actions → AWS V4 Deploy → Run workflow. Seleccionar la rama predeterminada.

- `seed_demo`: true para crear o reutilizar un owner, mascota y cita sintéticos.
- `enable_chaos`: false para empezar sin fallos.

El workflow compila y prueba primero. Después autentica contra la cuenta esperada, inicializa el estado S3, crea ECR, construye Docker, publica la imagen y crea la infraestructura. La etiqueta incluye commit, ejecución e intento; así no choca con la inmutabilidad de ECR al repetir un despliegue. El script reutiliza el estado existente, no crea una infraestructura paralela por cada ejecución.

ECS inicializa las tablas antes de arrancar. Al finalizar se comprueban health, listas y detalles de los datos sintéticos. Sin GCP configurado se acepta que `juego=null` y `integration.status=degraded`. Si configuraste `GCP_API_URL`, las pruebas EXIGEN que la integración responda bien; una URL rota o sin juegos hace fallar la prueba, aunque la infraestructura ya esté creada. Corregir la dependencia y repetir, sin destruir por ese motivo.

El Summary de la ejecución muestra la URL HTTP de la API, la URL HTTPS para GET por CloudFront, el commit y la etiqueta de imagen. Guardar la URL base como variable `CHAOS_BASE_URL` del repositorio. Los POST de prueba se hacen contra la URL ALB; CloudFront heredado sólo permite GET/HEAD.

Si hay un error, abrir el paso rojo y el diagnóstico ECS. No ejecutar destroy para arreglar un AccessDenied. No publicar `terraform state`, planes ni salidas completas de Secrets Manager como artefactos: pueden contener secretos. El workflow no sube esos archivos.

## Conectar la API GCP y ejecutar caos

Cuando tu compañera tenga Videojuegos funcionando y al menos un juego:

1. Poner su URL base en la variable GitHub `GCP_API_URL` de Veterinaria.
2. Darle tu URL AWS para que configure `PEER_API_URL` de su deployment GCP.
3. Volver a ejecutar AWS V4 Deploy con `seed_demo=true` y caos apagado.
4. Comprobar que /owners, /pets y /appointments devuelvan data local y exactamente un juego actual, también por ID.

La semilla de este nuevo workflow crea sólo los datos AWS. No ejecuta el antiguo `seed-v4.py`, que necesita las dos nubes y crearía también juegos/compras. La semilla nueva usa marcas sintéticas fijas y reutiliza registros al redeplegar sin destruir.

Para el experimento, acordar ventana y habilitar caos en ambas APIs. En AWS se hace ejecutando Deploy con `enable_chaos=true`; en GCP actualizar la variable CHAOS_ENABLED. Actualizar `CHAOS_BASE_URL` y ejecutar V4 Chaos quality gate marcando la ventana acordada. Conservar sus artefactos y completar el informe. Ejecutar los experimentos de ambos integrantes uno a la vez; GitHub no coordina la concurrencia entre dos repositorios distintos.

## Destruir después de probar

Guardar primero las evidencias de Actions y el informe. Actions → AWS V4 Destroy → Run workflow. Escribir exactamente `DESTRUIR`.

La operación elimina la base RDS SIN snapshot final y sus datos. Es intencional para el laboratorio: el siguiente Deploy recrea esquema y datos sintéticos si seed_demo=true. Si necesitas conservar registros adicionales, expórtalos antes y no ejecutes Destroy hasta haberlos preservado.

| Se destruye con este workflow | Se conserva para volver a desplegar |
|---|---|
| ECS y tareas | Código y workflows en GitHub |
| ALB y grupos de destino | Bucket S3 y versiones del estado |
| RDS y datos de la API | Usuario IAM dedicado, política y access key |
| VPC, NAT, subredes y direcciones administradas por el stack | Secretos y variables del repositorio |
| ECR e imágenes de este proyecto | Evidencia que hayas guardado de las ejecuciones |
| CloudFront del proyecto | Roles vinculados al servicio que AWS mantenga fuera de Terraform |
| Secretos de aplicación y rol de ejecución ECS | |
| Log group del stack y grupo automático exacto de Container Insights | |

El bucket no se borra porque se creó fuera del stack. Terraform escribe el resultado del destroy en ese mismo estado; no borres el estado ni uses `state rm` para simular que destruiste recursos. El workflow comprueba que no queden recursos administrados en ese estado y elimina sólo el grupo automático de logs de este cluster.

No afirma costo cero de toda la cuenta: el bucket/versiones ocupan almacenamiento y puede haber recursos ajenos al stack. No borra recursos de V1/V2/V3 que estén en otros estados. Las políticas IAM/SCP de tu cuenta aún pueden impedir una eliminación; si falla el destroy, leer el error y repetir tras corregirlo. CloudFront puede prolongar la operación. No cancelar simplemente porque tarde varios minutos.

## Redesplegar para la sustentación

Ejecutar otra vez AWS V4 Deploy desde el mismo repositorio, con seed_demo=true. No necesitas CloudShell, otro bucket ni nuevas claves. La imagen se reconstruye desde el commit elegido y se crea otra vez toda la infraestructura.

Las URLs pueden cambiar tras una destrucción completa. Actualizar:

- `CHAOS_BASE_URL` del repositorio AWS.
- `PEER_API_URL` del deployment GCP que consume mascotas.
- Variables o URLs base de Postman y jobs externos de métricas.
- `GCP_API_URL` en AWS si tu compañera también reconstruyó y cambió su dirección.

En Google Cloud Shell, si mantiene el manifiesto de la V4 entregada, la actualización de AWS es:

```bash
kubectl -n chaos set env deployment/videojuegos PEER_API_URL='NUEVA_URL_BASE_AWS'
kubectl -n chaos rollout status deployment/videojuegos --timeout=600s
```

También debe guardar esa URL en su configuración de despliegue para no revertirla en el siguiente deploy.

Hacer un ciclo completo Deploy → pruebas → Destroy → Deploy ANTES de la sustentación y conservar tiempo para RDS/CloudFront y verificar ambas nubes. No depender de levantar todo minutos antes de presentar. Mantener las APIs desplegadas durante la demostración.

## Validación de estos cambios

Se revisaron sintaxis Bash, sintaxis YAML y workflows con actionlint. Se probaron tres casos de la nueva verificación: semilla repetible sin duplicados, primer despliegue sin GCP y fallo si GCP está configurado pero no responde correctamente. Los tests del gate se conservan y el workflow de despliegue ejecuta compilación y tests antes de cambiar AWS.

No se ejecutó el bootstrap en tu cuenta, no se crearon credenciales reales, no se publicaron commits en tu repositorio ni se desplegó infraestructura desde esta sesión. La validación IAM, cuotas y Terraform con los proveedores se completa en tu primera ejecución. Esta guía corresponde al nombre de proyecto por defecto `api-restful-veterinaria`; cambiarlo requiere actualizar la política IAM y los nombres del diagnóstico/limpieza.

## Referencias

- Autenticación de GitHub Actions contra AWS: https://github.com/aws-actions/configure-aws-credentials
- OIDC evita claves duraderas cuando la organización lo autoriza: https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws
- Denegaciones explícitas y SCP: https://docs.aws.amazon.com/IAM/latest/UserGuide/troubleshoot_access-denied.html
