terraform {
  backend "s3" {
    # Mismo bucket de estado que V3 estable, pero una key independiente.
    # terraform init -backend-config="bucket=<TF_STATE_BUCKET>"
    key          = "api-restful-veterinaria/v3-canary/terraform.tfstate"
    region       = "us-east-2"
    encrypt      = true
    use_lockfile = true
  }
}
