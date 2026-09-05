import { defaultNsgRules, type Lab } from "../types";

const nsg = defaultNsgRules();

export const lab: Lab = {
    id: "default-outbound-gone",
    code: "INC-4188",
    title: "Backend recebe, mas não chega na internet",
    difficulty: "cne",
    technologies: ["load-balancer", "public-ip", "nsg", "ports"],
    severity: "Sev1",
    etaMin: 22,
    ticket: {
      title: "apt-get e nuget falham após migrar para Standard LB",
      reporter: "SRE · payments",
      service: "rg-pay / lb-pay",
      openedAt: "2026-09-04T21:18:00-03:00",
      description:
        "Migração Basic → Standard Load Balancer. Inbound 443 pelo frontend 20.62.9.15 funciona. As VMs do backend perderam egresso: apt, nuget, wget github. NSG outbound Allow Internet está presente. Não há NAT Gateway nem PIP de instância. outboundRules do LB está vazio.",
      symptoms: [
        "curl https://20.62.9.15 → 200 (inbound ok)",
        "From vm-pay-01: curl https://github.com → timeout",
        "az network lb outbound-rule list → []",
      ],
      impact: "Pagamentos ok, mas sem patch e sem puxar pacotes. Risco Sev1 em 24 h.",
      lastChange: "LB SKU Standard; default outbound access desativado na subscription.",
    },
    topology: {
      nodes: [
        { id: "inet", kind: "internet", label: "Internet", x: 50, y: 8 },
        { id: "lb", kind: "lb", label: "lb-pay Standard", sublabel: "20.62.9.15 · sem outbound", x: 50, y: 26, status: "warn" },
        { id: "vnet", kind: "vnet", label: "vnet-pay  10.60.0.0/16", x: 16, y: 42, w: 68, h: 48 },
        { id: "snet", kind: "subnet", label: "snet-pay", sublabel: "10.60.4.0/24", x: 24, y: 56, w: 52, h: 26, parentId: "vnet" },
        { id: "vm", kind: "vm", label: "vm-pay-01", sublabel: "10.60.4.8", x: 48, y: 68, status: "error", parentId: "snet" },
      ],
      edges: [
        { from: "inet", to: "lb", kind: "ok", label: "in 443" },
        { from: "lb", to: "vm", kind: "ok" },
        { from: "vm", to: "inet", kind: "blocked", label: "sem SNAT" },
      ],
    },
    world: {
      subscription: "Contoso Connectivity",
      subscriptionId: "a1b2c3d4-0012-4e11-9c01-snat",
      resourceGroup: "rg-pay",
      location: "brazilsouth",
      vnets: [
        {
          name: "vnet-pay",
          space: ["10.60.0.0/16"],
          subnets: [{ name: "snet-pay", prefix: "10.60.4.0/24", nsg: "nsg-pay" }],
        },
      ],
      nsgs: [
        {
          name: "nsg-pay",
          rules: [
            {
              name: "Allow-443-in",
              priority: 200,
              direction: "Inbound",
              access: "Allow",
              protocol: "Tcp",
              source: "Internet",
              sourcePort: "*",
              dest: "*",
              destPort: "443",
            },
            ...nsg,
          ],
        },
      ],
      routeTables: [],
      vms: [
        {
          name: "vm-pay-01",
          os: "linux",
          vnet: "vnet-pay",
          subnet: "snet-pay",
          privateIp: "10.60.4.8",
          nsg: "nsg-pay",
          nic: "nic-pay-01",
          power: "VM running",
          size: "Standard_D2s_v5",
        },
        {
          name: "vm-pay-02",
          os: "linux",
          vnet: "vnet-pay",
          subnet: "snet-pay",
          privateIp: "10.60.4.9",
          nsg: "nsg-pay",
          nic: "nic-pay-02",
          power: "VM running",
          size: "Standard_D2s_v5",
        },
      ],
      peerings: [],
      lbs: [
        {
          name: "lb-pay",
          sku: "Standard",
          frontend: "20.62.9.15",
          probes: [{ name: "probe-443", proto: "Tcp", port: 443 }],
          rules: [{ name: "rule-443", frontendPort: 443, backendPort: 443, proto: "Tcp", probe: "probe-443" }],
          backends: [
            { name: "vm-pay-01", ip: "10.60.4.8", healthy: true },
            { name: "vm-pay-02", ip: "10.60.4.9", healthy: true },
          ],
          outboundRules: [],
        },
      ],
      firewalls: [],
      vpns: [],
      dnsZones: [],
      publicIps: [{ name: "pip-lb-pay", ip: "20.62.9.15", sku: "Standard", attachedTo: "lb-pay" }],
    },
    connectivity: [
      { from: "internet", to: "20.62.9.15", proto: "tcp", port: 443, result: "ok" },
      { from: "vm-pay-01", to: "github.com", proto: "tcp", port: 443, result: "timeout", note: "sem outbound SNAT" },
      { from: "vm-pay-01", to: "8.8.8.8", proto: "icmp", result: "timeout" },
      { from: "vm-pay-01", to: "10.60.4.9", proto: "icmp", result: "ok" },
    ],
    hypotheses: [
      { id: "a", label: "NSG Deny Internet outbound", correct: false },
      { id: "b", label: "Standard LB sem outbound rule / NAT GW / PIP — default outbound retired", correct: true },
      { id: "c", label: "DNS 168.63.129.16 bloqueado", correct: false },
      { id: "d", label: "UDR 0.0.0.0/0 None", correct: false },
    ],
    hints: [
      "Inbound saudável com egresso morto, após troca para Standard, é quase sempre SNAT — não NSG.",
      "Liste outbound-rule do LB, Public IPs das NICs e NAT Gateways da subnet.",
      "NICs sem PIP, LB sem outboundRules, subnet sem NAT Gateway. Default outbound access foi desligado. Não há SNAT.",
    ],
    debrief: {
      rootCause:
        "Default outbound access foi aposentado. Com Standard LB apenas inbound, sem outbound rule, sem NAT Gateway e sem PIP de instância, as VMs não têm SNAT para a internet. NSG Allow Internet outbound é irrelevante sem caminho L3/L4 de saída.",
      solution:
        "Prefira NAT Gateway na subnet. Alternativa: outbound rule no Standard LB (cuidado com SNAT ports) ou PIP de instância. Recalcule portas SNAT se usar LB.",
      commands: [
        "az network lb outbound-rule list -g rg-pay --lb-name lb-pay",
        "az network nic show -g rg-pay -n nic-pay-01 --query ipConfigurations",
        "az network nat gateway list -g rg-pay",
      ],
      conceptTitle: "Default outbound e SNAT",
      concept:
        "VMs sem método explícito de egresso deixaram de receber IP público implícito. Standard LB inbound não fornece SNAT até existir outbound rule. NAT Gateway é o padrão atual para egresso previsível.",
      prevention:
        "Landing zone: NAT Gateway por spoke (ou Firewall). Checklist de migração Basic→Standard inclui outbound. Monitorar falhas de 443 egresso após o cutover.",
    },
  };
