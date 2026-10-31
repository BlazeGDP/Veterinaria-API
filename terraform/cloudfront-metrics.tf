# Grafana Cloud Metrics Endpoint requires a publicly accessible HTTPS URL.
# CloudFront provides HTTPS using its default *.cloudfront.net certificate,
# while the ALB remains the HTTP origin inside this dedicated metrics path.
data "aws_cloudfront_cache_policy" "metrics_no_cache" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "metrics_forward_headers" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "metrics" {
  enabled         = true
  comment         = "${var.project_name} Prometheus metrics HTTPS endpoint"
  price_class     = "PriceClass_100"
  is_ipv6_enabled = true

  origin {
    domain_name = aws_lb.api.dns_name
    origin_id   = "${var.project_name}-alb-metrics-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "${var.project_name}-alb-metrics-origin"
    viewer_protocol_policy = "https-only"

    allowed_methods = ["GET", "HEAD"]
    cached_methods  = ["GET", "HEAD"]

    cache_policy_id          = data.aws_cloudfront_cache_policy.metrics_no_cache.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.metrics_forward_headers.id
    compress                 = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name    = "${var.project_name}-metrics-https"
    Purpose = "Grafana Cloud Prometheus scraping"
  }
}
