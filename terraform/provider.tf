provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "api-restful-veterinaria"
      Environment = var.environment
      Version     = "v3"
      ManagedBy   = "Terraform"
    }
  }
}