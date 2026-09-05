import { defaultNsgRules, type Lab } from "../types";

const nsg = defaultNsgRules();

export const lab: Lab = {
    id: "nsg-missing-443",
    code: "INC-1103",
    title: "Portal HTTPS fora, HTTP responde reset",
    difficulty: "iniciante",
    technologies: ["nsg", "ports", "public-ip", "subnet"],
    severity: "Sev2",
    etaMin: 10,
    ticket: {
      title: "https://20.44.18.77 não abre o portal de clientes",
      reporter: "Lia Borges · Front",
      service: "rg-portal / vm-web-01",
      openedAt: "2026-09-05T07:05:00-03:00",
      description:
        "O portal foi migrado de HTTP:80 para HTTPS:443 ontem. nginx escuta 443. O time de rede liberou a porta 80 no NSG 'porque o site já funcionava'. Usuários relatam timeout no cadeado HTTPS e connection refused em HTTP.",
      symptoms: [
        "curl -I https://20.44.18.77 → timeout",
        "curl -I http://20.44.18.77 → connection refused",
        "nginx -t ok; listen 443 ssl",
      ],
      impact: "Portal de clientes indisponível. Sev2 comercial.",
      lastChange: "Ontem 22:10: cutover TLS. NSG não atualizado.",
    },
    topology: {
      nodes: [
        { id: "inet", kind: "internet", label: "Internet", x: 50, y: 8 },
        { id: "pip", kind: "pip", label: "pip-web", sublabel: "20.44.18.77", x: 50, y: 22, status: "ok" },
        { id: "vnet", kind: "vnet", label: "vnet-portal  10.30.0.0/16", x: 16, y: 36, w: 68, h: 54 },
        { id: "snet", kind: "subnet", label: "snet-web", sublabel: "10.30.8.0/24", x: 24, y: 50, w: 52, h: 32, parentId: "vnet" },
        { id: "nsg", kind: "nsg", label: "nsg-web", x: 32, y: 56, status: "error", parentId: "snet" },
        { id: "vm", kind: "vm", label: "vm-web-01", sublabel: "10.30.8.10 :443", x: 56, y: 68, status: "warn", parentId: "snet" },
      ],
      edges: [
        { from: "inet", to: "pip", kind: "ok" },
        { from: "pip", to: "nsg", kind: "blocked", label: "TCP/443" },
        { from: "nsg", to: "vm", kind: "ok", label: "TCP/80" },
      ],
    },
    world: {
      subscription: "Contoso Connectivity",
      subscriptionId: "a1b2c3d4-0003-4e11-9c01-portal",
      resourceGroup: "rg-portal",
      location: "brazilsouth",
      vnets: [
        {
          name: "vnet-portal",
          space: ["10.30.0.0/16"],
          subnets: [{ name: "snet-web", prefix: "10.30.8.0/24", nsg: "nsg-web" }],
        },
      ],
      nsgs: [
        {
          name: "nsg-web",
          rules: [
            {
              name: "Allow-HTTP",
              priority: 200,
              direction: "Inbound",
              access: "Allow",
              protocol: "Tcp",
              source: "Internet",
              sourcePort: "*",
              dest: "*",
              destPort: "80",
            },
            ...nsg,
          ],
        },
      ],
      routeTables: [],
      vms: [
        {
          name: "vm-web-01",
          os: "linux",
          vnet: "vnet-portal",
          subnet: "snet-web",
          privateIp: "10.30.8.10",
          publicIp: "20.44.18.77",
          nsg: "nsg-web",
          nic: "nic-web-01",
          power: "VM running",
          size: "Standard_B2ms",
        },
      ],
      peerings: [],
      lbs: [],
      firewalls: [],
      vpns: [],
      dnsZones: [],
      publicIps: [{ name: "pip-web", ip: "20.44.18.77", sku: "Standard", attachedTo: "nic-web-01" }],
    },
    connectivity: [
      { from: "internet", to: "20.44.18.77", proto: "tcp", port: 443, result: "timeout", note: "NSG não permite 443" },
      { from: "internet", to: "20.44.18.77", proto: "tcp", port: 80, result: "reject", note: "NSG permite, processo não escuta 80" },
      { from: "vm-web-01", to: "20.44.18.77", proto: "tcp", port: 443, result: "ok" },
    ],
    hypotheses: [
      { id: "a", label: "Certificado TLS inválido no nginx", correct: false },
      { id: "b", label: "Public IP associado à NIC errada", correct: false },
      { id: "c", label: "NSG permite 80 mas não 443; o serviço só escuta 443", correct: true },
      { id: "d", label: "UDR 0.0.0.0/0 aponta para Firewall inexistente", correct: false },
    ],
    hints: [
      "Timeout em HTTPS costuma ser path/NSG. Connection refused em HTTP costuma ser 'chegou na VM, ninguém escuta a porta'.",
      "Compare destPort das regras inbound com a porta em que o processo escuta.",
      "nsg-web tem Allow-HTTP :80 e nenhuma regra :443. DenyAllInBound 65500 descarta 443.",
    ],
    debrief: {
      rootCause:
        "Cutover para TLS na 443 sem regra NSG correspondente. 443 cai no DenyAllInBound (timeout). 80 passa no NSG mas o nginx não escuta 80 (refused).",
      solution:
        "Adicione Allow inbound TCP/443 com source controlado. Remova 80 se o serviço não o usa, ou redirecione 80→443 no nginx e permita ambas.",
      commands: [
        "az network nsg rule list -g rg-portal --nsg-name nsg-web -o table",
        "tnc 20.44.18.77 -Port 443",
        "az network nsg rule create -g rg-portal --nsg-name nsg-web -n Allow-HTTPS --priority 210 --destination-port-ranges 443 --access Allow --protocol Tcp --direction Inbound --source-address-prefixes Internet",
      ],
      conceptTitle: "Porta do NSG vs porta do processo",
      concept:
        "NSG filtra antes do SO. Timeout = filtrado no caminho. Refused = chegou no host, socket fechado. Esses dois sinais separam regra de rede de configuração de aplicação.",
      prevention:
        "Checklist de cutover HTTP→HTTPS: certificado, listen, probe, NSG, LB rule, DNS. Teste com tnc/curl nas duas portas antes do go-live.",
    },
  };
