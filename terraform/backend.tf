terraform {
  backend "s3" {
    # El bucket NO se escribe aquí. Se entrega al inicializar:
    #   terraform init -backend-config="bucket=api-restful-veterinaria-tf-state-<ACCOUNT_ID>"
    key          = "api-restful-veterinaria/v3/terraform.tfstate"
    region       = "us-east-2"
    encrypt      = true
    use_lockfile = true
  }
}
