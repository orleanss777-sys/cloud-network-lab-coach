import { defaultNsgRules, type Lab } from "../types";

const nsg = defaultNsgRules();

export const lab: Lab = {
    id: "lb-probe-port",
    code: "INC-2314",
    title: "Load Balancer marca backends unhealthy",
    difficulty: "n2",
    technologies: ["load-balancer", "ports", "nsg", "public-ip"],
    severity: "Sev1",
    etaMin: 16,
    ticket: {
      title: "lb-web 0/2 healthy — site fora",
      reporter: "NOC Contoso",
      service: "rg-edge / lb-web",
      openedAt: "2026-09-05T06:48:00-03:00",
      description:
        "Standard Public LB na frente de duas VMs nginx. Frontend 20.91.4.22:443. Pool mostra 0 healthy. Nas VMs, nginx está up em 8080. Health probe foi deixado no default HTTP/80 /.",
      symptoms: [
        "Backend pool: vm-web-a e vm-web-b Down",
        "curl localhost:8080 nas VMs retorna 200",
        "NSG permite 8080 e AzureLoadBalancer",
      ],
      impact: "Site institucional indisponível. Sev1.",
      lastChange: "App shift 80→8080 na madrugada; probe não atualizado.",
    },
    topology: {
      nodes: [
        { id: "inet", kind: "internet", label: "Internet", x: 50, y: 8 },
        { id: "lb", kind: "lb", label: "lb-web", sublabel: "20.91.4.22  0/2", x: 50, y: 24, status: "error" },
        { id: "vnet", kind: "vnet", label: "vnet-edge  10.50.0.0/16", x: 12, y: 40, w: 76, h: 50 },
        { id: "snet", kind: "subnet", label: "snet-web", sublabel: "10.50.3.0/24", x: 20, y: 54, w: 60, h: 28, parentId: "vnet" },
        { id: "vma", kind: "vm", label: "vm-web-a", sublabel: "10.50.3.4 :8080", x: 32, y: 68, status: "ok", parentId: "snet" },
        { id: "vmb", kind: "vm", label: "vm-web-b", sublabel: "10.50.3.5 :8080", x: 62, y: 68, status: "ok", parentId: "snet" },
      ],
      edges: [
        { from: "inet", to: "lb", kind: "ok", label: "443" },
        { from: "lb", to: "vma", kind: "blocked", label: "probe :80" },
        { from: "lb", to: "vmb", kind: "blocked", label: "probe :80" },
      ],
    },
    world: {
      subscription: "Contoso Connectivity",
      subscriptionId: "a1b2c3d4-0007-4e11-9c01-lb",
      resourceGroup: "rg-edge",
      location: "brazilsouth",
      vnets: [
        {
          name: "vnet-edge",
          space: ["10.50.0.0/16"],
          subnets: [{ name: "snet-web", prefix: "10.50.3.0/24", nsg: "nsg-web" }],
        },
      ],
      nsgs: [
        {
          name: "nsg-web",
          rules: [
            {
              name: "Allow-8080",
              priority: 200,
              direction: "Inbound",
              access: "Allow",
              protocol: "Tcp",
              source: "*",
              sourcePort: "*",
              dest: "*",
              destPort: "8080",
            },
            ...nsg,
          ],
        },
      ],
      routeTables: [],
      vms: [
        {
          name: "vm-web-a",
          os: "linux",
          vnet: "vnet-edge",
          subnet: "snet-web",
          privateIp: "10.50.3.4",
          nsg: "nsg-web",
          nic: "nic-web-a",
          power: "VM running",
          size: "Standard_B2s",
        },
        {
          name: "vm-web-b",
          os: "linux",
          vnet: "vnet-edge",
          subnet: "snet-web",
          privateIp: "10.50.3.5",
          nsg: "nsg-web",
          nic: "nic-web-b",
          power: "VM running",
          size: "Standard_B2s",
        },
      ],
      peerings: [],
      lbs: [
        {
          name: "lb-web",
          sku: "Standard",
          frontend: "20.91.4.22",
          probes: [{ name: "probe-http", proto: "Http", port: 80, path: "/" }],
          rules: [{ name: "rule-https", frontendPort: 443, backendPort: 8080, proto: "Tcp", probe: "probe-http" }],
          backends: [
            { name: "vm-web-a", ip: "10.50.3.4", healthy: false },
            { name: "vm-web-b", ip: "10.50.3.5", healthy: false },
          ],
          outboundRules: [],
        },
      ],
      firewalls: [],
      vpns: [],
      dnsZones: [],
      publicIps: [{ name: "pip-lb-web", ip: "20.91.4.22", sku: "Standard", attachedTo: "lb-web" }],
    },
    connectivity: [
      { from: "internet", to: "20.91.4.22", proto: "tcp", port: 443, result: "timeout", note: "pool 0 healthy" },
      { from: "vm-web-a", to: "10.50.3.4", proto: "tcp", port: 8080, result: "ok" },
      { from: "vm-web-a", to: "10.50.3.4", proto: "tcp", port: 80, result: "reject" },
      { from: "vm-web-b", to: "10.50.3.5", proto: "tcp", port: 8080, result: "ok" },
    ],
    hypotheses: [
      { id: "a", label: "NSG bloqueia AzureLoadBalancer", correct: false },
      { id: "b", label: "VMs estão deallocated", correct: false },
      { id: "c", label: "Probe HTTP/80 não casa com nginx em 8080 — pool fica 0/2", correct: true },
      { id: "d", label: "Frontend IP está em Basic SKU e não escala", correct: false },
    ],
    hints: [
      "LB só encaminha para backends healthy. 0/2 significa que a regra 443→8080 nunca entra em jogo.",
      "Compare probe.port com a porta em que o processo escuta e com a backendPort da regra.",
      "probe-http usa HTTP:80 /. nginx escuta 8080. A regra já aponta backend 8080 — só o probe ficou para trás.",
    ],
    debrief: {
      rootCause:
        "Health probe HTTP na porta 80, enquanto o nginx escuta 8080. Probes falham, o pool fica unhealthy e o LB descarta o tráfego de 443 mesmo com a regra correta.",
      solution:
        "Atualize o probe para TCP ou HTTP na porta 8080 (path /health se existir). Confirme NSG Allow AzureLoadBalancer e a porta do probe.",
      commands: [
        "az network lb probe list -g rg-edge --lb-name lb-web -o table",
        "az network lb rule list -g rg-edge --lb-name lb-web -o table",
        "az network lb probe update -g rg-edge --lb-name lb-web -n probe-http --protocol Tcp --port 8080",
      ],
      conceptTitle: "Health probe vs backend port",
      concept:
        "A regra de LB define o datapath. O probe define quem entra no datapath. Eles podem (e muitas vezes devem) usar a mesma porta, mas não são o mesmo objeto. Probe errado = site fora com VMs saudáveis.",
      prevention:
        "No mesmo PR que muda a porta da app, atualize probe, NSG, LB rule e dashboard de health. Alarme se healthy hosts = 0.",
    },
  };
