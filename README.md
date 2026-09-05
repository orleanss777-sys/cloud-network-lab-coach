# Cloud Network Lab Coach

Simulador e treinador de troubleshooting de **Azure Networking** para quem quer atuar como Cloud Network Engineer.

Interface no estilo console de infraestrutura (NÃO um app educacional infantil): ticket de incidente, topologia, terminal simulado e coach com pistas progressivas.

**Repo:** https://github.com/orleanss777-sys/cloud-network-lab-coach

## O que o lab cobre

- Azure Virtual Network, Subnets, NSG, Route Tables / UDR
- DNS privado, Private IP, Public IP
- VNet Peering, Load Balancer, VPN, Azure Firewall
- Portas TCP/UDP e conectividade entre VMs

## Níveis

| Nível | Foco |
| --- | --- |
| Iniciante | VNet, NSG, IP público/privado |
| N2 | UDR, peering, DNS privado, health probe |
| N3 | Firewall, VPN, roteamento assimétrico |
| Cloud Network Engineer | Hub-spoke, transitivity, outbound/SNAT |

## Catálogo (12 incidentes)

1. NSG Deny SSH com prioridade mais alta que o Allow
2. VM sem Public IP (RDP da internet em RFC1918)
3. Cutover HTTPS sem regra NSG 443
4. UDR `0.0.0.0/0` next hop `None` (blackhole)
5. Peering one-way (`Initiated` no hub)
6. Private DNS zone sem VNet link
7. Load Balancer probe na porta errada
8. Roteamento assimétrico (UDR `/8` via NVA sem SNAT)
9. Azure Firewall sem regra 443
10. VPN Connected com CIDR overlap
11. Peering não transitivo (spoke–spoke)
12. Default outbound retired (Standard LB sem SNAT)

O terminal simula `az`, `ping`, `curl`, `tnc`, `nslookup` e effective routes/NSG contra o world state de cada lab. A IA do coach **não revela a causa raiz** de imediato.

## Stack

React 19 · TanStack Start · Tailwind v4 · Zustand · TypeScript

## Como clonar

```bash
git clone https://github.com/orleanss777-sys/cloud-network-lab-coach.git
cd cloud-network-lab-coach
npm install
npm run dev
```

## Status

Catálogo de 12 labs, motor do terminal (`az` / ping / curl / tnc) e componentes de UI já no repositório. O fluxo visual completo (central de comando → investigação → debrief) continua em evolução.

## Licença

Uso pessoal / portfólio.
