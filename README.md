# Cloud Network Lab Coach

Simulador e treinador de troubleshooting de **Azure Networking** para quem quer atuar como Cloud Network Engineer.

Interface no estilo console de infraestrutura: ticket de incidente, topologia, terminal simulado e coach com pistas progressivas.

## O que o lab cobre

- Azure Virtual Network, Subnets, NSG, Route Tables / UDR
- DNS privado, Private IP, Public IP
- VNet Peering, Load Balancer, VPN, Azure Firewall
- Portas TCP/UDP e conectividade entre VMs

## Niveis

| Nivel | Foco |
| --- | --- |
| Iniciante | VNet, NSG, IP publico/privado |
| N2 | UDR, peering, DNS privado, health probe |
| N3 | Firewall, VPN, roteamento assimetrico |
| Cloud Network Engineer | Hub-spoke, transitivity, outbound/SNAT |

## Catalogo (12 incidentes)

1. NSG Deny SSH com prioridade mais alta que o Allow
2. VM sem Public IP (RDP da internet em RFC1918)
3. Cutover HTTPS sem regra NSG 443
4. UDR `0.0.0.0/0` next hop `None` (blackhole)
5. Peering one-way (`Initiated` no hub)
6. Private DNS zone sem VNet link
7. Load Balancer probe na porta errada
8. Roteamento assimetrico (UDR `/8` via NVA sem SNAT)
9. Azure Firewall sem regra 443
10. VPN Connected com CIDR overlap
11. Peering nao transitivo (spoke-spoke)
12. Default outbound retired (Standard LB sem SNAT)

O terminal simula `az`, `ping`, `curl`, `tnc`, `nslookup` e effective routes/NSG contra o world state de cada lab. O coach **nao revela a causa raiz** de imediato.

## Stack

React 19 · TanStack Start · Tailwind v4 · Zustand · TypeScript

## Status

MVP em construcao: catalogo, motor do terminal, pontuacao e componentes de UI.
