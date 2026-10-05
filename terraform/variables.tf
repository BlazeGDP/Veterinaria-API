variable "aws_region" {
  description = "Región AWS donde se desplegará la infraestructura."
  type        = string
  default     = "us-east-2"
}

variable "environment" {
  description = "Nombre del ambiente."
  type        = string
  default     = "v3"
}

variable "project_name" {
  description = "Nombre base del proyecto."
  type        = string
  default     = "api-restful-veterinaria"
}

variable "vpc_cidr" {
  description = "CIDR principal de la VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability Zones utilizadas por la infraestructura."
  type        = list(string)

  default = [
    "us-east-2a",
    "us-east-2b"
  ]
}

variable "public_subnet_cidrs" {
  description = "CIDRs de las subnets públicas."
  type        = list(string)

  default = [
    "10.0.1.0/24",
    "10.0.2.0/24"
  ]
}

variable "private_subnet_cidrs" {
  description = "CIDRs de las subnets privadas."
  type        = list(string)

  default = [
    "10.0.11.0/24",
    "10.0.12.0/24"
  ]
}

variable "container_port" {
  description = "Puerto donde escucha NestJS."
  type        = number
  default     = 3000
}

variable "ecs_cpu" {
  description = "CPU asignada a la tarea Fargate."
  type        = number
  default     = 256
}

variable "ecs_memory" {
  description = "Memoria asignada a la tarea Fargate."
  type        = number
  default     = 512
}

variable "ecs_desired_count" {
  description = "Cantidad de tareas ECS."
  type        = number
  default     = 1
}

variable "db_name" {
  description = "Nombre de la base de datos PostgreSQL."
  type        = string
  default     = "veterinaria"
}

variable "db_username" {
  description = "Usuario administrador de PostgreSQL."
  type        = string
  default     = "veterinariaadmin"
}

variable "db_password" {
  description = "Contraseña del usuario PostgreSQL."
  type        = string
  sensitive   = true
}