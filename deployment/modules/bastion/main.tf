


resource "aws_instance" "bastion" {
  ami                    = "ami-0884d2865dbe9de4b"
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  iam_instance_profile   = var.bastion_instance_profile_name
  vpc_security_group_ids = [var.bastion_security_group_id]

  tags = {
    Name = "${var.app_name}-${var.app_environment}-bastion"
  }
}
