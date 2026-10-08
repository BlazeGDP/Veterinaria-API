terraform {
  backend "s3" {
    bucket       = "REPLACE_WITH_TERRAFORM_STATE_BUCKET"
    key          = "api-restful-veterinaria/v3/terraform.tfstate"
    region       = "us-east-2"
    encrypt      = true
    use_lockfile = true
  }
}
