variable "aws_region" {
  description = "Región AWS donde se despliega la API."
  type        = string
  default     = "us-east-2"
}

variable "tf_state_bucket" {
  description = "Bucket S3 que contiene el state remoto de la V3 estable."
  type        = string
}

variable "project_name" {
  description = "Nombre base compartido con la infraestructura estable."
  type        = string
  default     = "api-restful-veterinaria"
}

variable "image_tag" {
  description = "Tag inmutable de la imagen de la API V3.1 Canary en ECR."
  type        = string
}

variable "container_port" {
  description = "Puerto HTTP interno de NestJS."
  type        = number
  default     = 3000
}

variable "ecs_cpu" {
  description = "CPU Fargate (unidades)."
  type        = number
  default     = 256
}

variable "ecs_memory" {
  description = "Memoria Fargate en MiB."
  type        = number
  default     = 512
}

variable "ecs_desired_count" {
  description = "Cantidad de tareas Canary."
  type        = number
  default     = 1
}

variable "api_version" {
  description = "Versión semántica de Canary."
  type        = string
  default     = "3.1.0"
}
