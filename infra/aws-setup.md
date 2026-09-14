# AWS setup (Phase 1)

Everything is created in the client's AWS account, region `us-east-1`. Do the steps in order. Each step that produces evidence says which screenshot to take and what to name it; save screenshots into `docs/evidence/` (naming convention in `docs/evidence/README.md`).

Time needed: about two hours, plus DNS propagation.

## 0. Before you start

- The client has accepted the AWS BAA (step 1) and created an IAM user for us (step 2). Both are client tasks; the client kickoff email covers them.
- You have: our office public IP, the client office public IP, the domain name for n8n (for example `n8n.example-dental.com`) and access to its DNS.
- Retell egress IP is `100.20.5.228` (source: https://docs.retellai.com/features/secure-webhook). Check this page again on the day you build; if Retell changes it, the security group and the Caddyfile both need the new value.

## 1. Accept the AWS BAA in AWS Artifact (client, root or admin user)

1. Sign in to the AWS console as the account owner.
2. Open **AWS Artifact** (search "Artifact" in the top bar).
3. In the left menu choose **Agreements**, then the **Account agreements** tab.
4. Find **AWS Business Associate Addendum**. Click **Download and review**, read it, tick the acceptance checkbox, click **Accept**.
5. The status changes to **Active**.

Evidence: screenshot of the Agreements page showing "AWS Business Associate Addendum" with status Active and the account id visible. Save as `docs/evidence/aws-baa-accepted-YYYY-MM-DD.png`. Also download the accepted PDF as `docs/evidence/aws-baa-YYYY-MM-DD.pdf`.

Note: the BAA covers only HIPAA-eligible services. EC2, EBS, RDS, VPC, CloudWatch and IAM are all eligible. Do not add other services without checking the HIPAA eligible services list.

## 2. IAM user for us (client)

1. Open **IAM**, then **Users**, then **Create user**. Name: `bytes-contractor`.
2. Do not give console access unless we ask for it. Under **Permissions options** choose **Attach policies directly** and attach `AmazonEC2FullAccess`, `AmazonRDSFullAccess`, `AmazonVPCFullAccess`, `IAMReadOnlyAccess`, `CloudWatchReadOnlyAccess`.
3. After creation open the user, **Security credentials** tab, **Create access key**, use case **Command Line Interface**, download the CSV and send it to us through the password manager share, never by email.
4. Enable MFA on the client's own admin user if not already on (IAM, Users, the user, Security credentials, Assign MFA device).

At hand-off (Phase 10) the client deletes this user. Evidence then: screenshot of the Users list without `bytes-contractor`, saved as `docs/evidence/aws-iam-contractor-removed-YYYY-MM-DD.png`.

## 3. VPC and subnets

Use the default VPC in `us-east-1` unless the client already has a network standard. You need:

- One public subnet for EC2 (has a route to an internet gateway).
- Two private subnets in different availability zones for RDS (RDS requires a subnet group spanning at least two AZs). The default VPC's subnets are all public; that is acceptable here because RDS will be set **not publicly accessible** and its security group only allows the EC2 security group. If the client wants strictly private subnets, create two subnets without an internet gateway route and use those for the RDS subnet group.

## 4. Security groups

Create these in **EC2**, **Security Groups**, **Create security group**. Replace `OUR_IP` and `OFFICE_IP` with the real /32 addresses.

### `sg-n8n-host`

Inbound:

| Type | Port | Source | Reason |
|------|------|--------|--------|
| HTTPS | 443 | 100.20.5.228/32 | Retell webhooks and tool calls |
| HTTPS | 443 | OUR_IP/32 | Our access to the n8n editor |
| HTTPS | 443 | OFFICE_IP/32 | Client office access to the n8n editor and queue page |
| HTTP | 80 | 0.0.0.0/0 | Let's Encrypt HTTP-01 challenge only. Caddy redirects everything else to 443. |
| SSH | 22 | OUR_IP/32 | Administration |

Outbound: allow all (n8n calls Retell, NexHealth, Let's Encrypt, and RDS).

If the client prefers no open port 80, use Caddy's DNS challenge instead (needs a DNS provider plugin) and remove the port 80 rule.

### `sg-rds-postgres`

Inbound:

| Type | Port | Source | Reason |
|------|------|--------|--------|
| PostgreSQL | 5432 | `sg-n8n-host` (security group id) | Only the EC2 host may reach the database |

Outbound: none needed (leave the default or remove it).

Evidence: screenshot of each security group's inbound rules with the group id visible. Save as `docs/evidence/aws-sg-n8n-host-YYYY-MM-DD.png` and `docs/evidence/aws-sg-rds-YYYY-MM-DD.png`.

## 5. EC2 host

1. **EC2**, **Launch instance**.
2. Name: `n8n-receptionist`.
3. AMI: **Ubuntu Server 24.04 LTS (HVM), SSD volume type**, 64-bit x86.
4. Instance type: `t3.small` (2 vCPU, 2 GB). n8n plus Caddy fits comfortably; go to `t3.medium` if the office adds heavy workflows later.
5. Key pair: create `n8n-receptionist-key` (ED25519), download the `.pem`, store it in the password manager. Never commit it.
6. Network settings: default VPC, a public subnet, **Auto-assign public IP: enable**, security group: select existing `sg-n8n-host`.
7. Storage: 30 GiB gp3. Expand **Advanced** on the volume and set **Encrypted: Yes**, KMS key: `aws/ebs` (default). This is the setting the auditor will ask about.
8. Advanced details: **IMDSv2: required**. Leave the rest default.
9. Launch.
10. **Elastic IPs**: allocate one and associate it with the instance so the address survives reboots. Point the DNS `A` record for `n8n.<client-domain>` at this address.

Evidence: screenshot of the instance's **Storage** tab showing the root volume with Encrypted = Yes. Save as `docs/evidence/aws-ec2-ebs-encrypted-YYYY-MM-DD.png`.

### Host preparation

```bash
ssh -i n8n-receptionist-key.pem ubuntu@<elastic-ip>

sudo apt-get update && sudo apt-get -y upgrade
sudo apt-get -y install ca-certificates curl gnupg unattended-upgrades

# Docker Engine + compose plugin (official repo)
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get -y install docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker ubuntu && newgrp docker

# Automatic security updates
sudo dpkg-reconfigure -plow unattended-upgrades

# Clone and configure
git clone <repo-url> ~/dental-ai-receptionist
cd ~/dental-ai-receptionist/infra
cp .env.example .env && nano .env      # fill every value
mkdir -p certs
curl -o certs/rds-global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
docker compose up -d
docker compose logs -f n8n
```

When the log shows the editor is accessible, open `https://n8n.<client-domain>` from an allowed IP. Caddy will have obtained a certificate. Create the n8n owner account for the client admin, then invite our user as a member.

## 6. RDS Postgres

1. **RDS**, **Subnet groups**, **Create DB subnet group**: name `receptionist-db-subnets`, pick the two private (or default) subnets in two AZs.
2. **Databases**, **Create database**.
3. **Standard create**, engine **PostgreSQL**, version **16.x** (latest 16 minor).
4. Templates: **Free tier** is fine if available, otherwise **Dev/Test**. Single-AZ is acceptable for this workload.
5. DB instance identifier: `receptionist-db`. Master username `postgres`. Choose **Self managed** password and generate a 32-character one; store it in the password manager.
6. Instance class: **Burstable classes**, `db.t4g.micro`.
7. Storage: gp3, 20 GiB, **Enable storage autoscaling** with max 50 GiB.
8. Connectivity: **Don't connect to an EC2 compute resource** (we use security groups), VPC = default, subnet group = `receptionist-db-subnets`, **Public access: No**, VPC security group: choose existing `sg-rds-postgres`, AZ: no preference.
9. Database authentication: password.
10. Additional configuration:
    - Initial database name: `n8n`.
    - **Backup**: enable automated backups, retention **7 days**, choose a backup window outside office hours (for example 06:00 to 07:00 UTC).
    - **Encryption**: **Enable encryption**, key `aws/rds`.
    - Log exports: PostgreSQL log to CloudWatch (optional but useful).
    - Maintenance: enable auto minor version upgrade, window Sunday early morning.
    - **Deletion protection: enable**.
11. Create. Wait for status **Available**. Copy the endpoint into `.env` as `DB_POSTGRESDB_HOST`.

RDS Postgres 16 forces SSL by default (`rds.force_ssl = 1`). The compose file sets `DB_POSTGRESDB_SSL_ENABLED=true` with the RDS CA bundle, so no parameter group change is needed.

Evidence: screenshot of the database **Configuration** tab showing Encryption = Enabled, Publicly accessible = No, and the backup retention of 7 days. Save as `docs/evidence/aws-rds-encrypted-YYYY-MM-DD.png`.

### Create the application database and roles

From the EC2 host (the only place that can reach RDS):

```bash
sudo apt-get -y install postgresql-client
export PGSSLROOTCERT=~/dental-ai-receptionist/infra/certs/rds-global-bundle.pem
psql "host=<rds-endpoint> port=5432 dbname=postgres user=postgres sslmode=verify-full"
```

```sql
-- n8n's own database and user
create role n8n_app login password '<from .env DB_POSTGRESDB_PASSWORD>';
alter database n8n owner to n8n_app;

-- application database for the audit log, consent, queue and suppression tables
create database receptionist owner postgres;
```

Then follow `db/README.md` to apply `db/001..005` into the `receptionist` database.

## 7. CloudWatch alarms (recommended)

- EC2 `StatusCheckFailed` >= 1 for 2 periods: email the client admin and us.
- RDS `FreeStorageSpace` < 2 GB.
- RDS `CPUUtilization` > 80 percent for 15 minutes.

Create an SNS topic `receptionist-alerts` with both email addresses and point the alarms at it.

## 8. Verify (Phase 1 done criteria)

1. `https://n8n.<client-domain>` loads over HTTPS from an allowed IP and returns 403 from any other IP.
2. `curl -X POST https://n8n.<client-domain>/webhook-test/ping` from an allowed IP reaches a test workflow that inserts a row into `phi_access_log`:
   ```sql
   select occurred_at, actor, action, outcome from phi_access_log order by id desc limit 1;
   ```
3. `docker compose exec n8n env | grep EXECUTIONS_DATA_MAX_AGE` shows `168`.
4. `psql` from anywhere except the EC2 host times out (confirms RDS is private).

## 9. Screenshot checklist

| File name | What it shows |
|-----------|---------------|
| `aws-baa-accepted-YYYY-MM-DD.png` | AWS Artifact, BAA status Active, account id visible |
| `aws-baa-YYYY-MM-DD.pdf` | The accepted BAA document |
| `aws-sg-n8n-host-YYYY-MM-DD.png` | Inbound rules of `sg-n8n-host` |
| `aws-sg-rds-YYYY-MM-DD.png` | Inbound rules of `sg-rds-postgres` |
| `aws-ec2-ebs-encrypted-YYYY-MM-DD.png` | EC2 Storage tab, Encrypted = Yes |
| `aws-rds-encrypted-YYYY-MM-DD.png` | RDS Configuration tab: encryption, not public, 7-day backups |
| `aws-iam-contractor-removed-YYYY-MM-DD.png` | IAM Users list after hand-off, our user gone |

Take screenshots with the browser window wide enough that the account id (top right) and the date are visible. Do not crop out the region selector.
