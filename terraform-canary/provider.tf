provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = "v3-canary"
      Version     = "3.1.0"
      Track       = "canary"
      ManagedBy   = "Terraform"
    }
  }
}

data "terraform_remote_state" "stable" {
  backend = "s3"

  config = {
    bucket = var.tf_state_bucket
    key    = "api-restful-veterinaria/v3/terraform.tfstate"
    region = var.aws_region
  }
}
