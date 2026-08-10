---
title: "Kubernetes-LocalDNS"
published: 2026-01-05
description: "在 iptables 模式下（默认情况下），每个服务的 kube-proxy 在主机网络名称空间的 nat 表中创建一些 iptables 规则。"
tags: ["Kubernetes"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

## 超时原因

在 iptables 模式下（默认情况下），每个服务的 kube-proxy 在主机网络名称空间的 nat 表中创建一些 iptables 规则。

比如在集群中具有两个 DNS 服务器实例的 kube-dns 服务，其相关规则大致如下所示：

```shell
(1) -A PREROUTING -m comment --comment "kubernetes service portals" -j KUBE-SERVICES
<...>
(2) -A KUBE-SERVICES -d 10.96.0.10/32 -p udp -m comment --comment "kube-system/kube-dns:dns cluster IP" -m udp --dport 53 -j KUBE-SVC-TCOU7JCQXEZGVUNU
<...>
(3) -A KUBE-SVC-TCOU7JCQXEZGVUNU -m comment --comment "kube-system/kube-dns:dns" -m statistic --mode random --probability 0.50000000000 -j KUBE-SEP-LLLB6FGXBLX6PZF7
(4) -A KUBE-SVC-TCOU7JCQXEZGVUNU -m comment --comment "kube-system/kube-dns:dns" -j KUBE-SEP-LRVEW52VMYCOUSMZ
<...>
(5) -A KUBE-SEP-LLLB6FGXBLX6PZF7 -p udp -m comment --comment "kube-system/kube-dns:dns" -m udp -j DNAT --to-destination 10.32.0.6:53
<...>
(6) -A KUBE-SEP-LRVEW52VMYCOUSMZ -p udp -m comment --comment "kube-system/kube-dns:dns" -m udp -j DNAT --to-destination 10.32.0.7:53
```

我们知道每个 Pod 的 `/etc/resolv.conf` 文件中都有填充的 `nameserver 10.96.0.10` 这个条目。所以来自 Pod 的 DNS 查找请求将发送到 `10.96.0.10`，这是 kube-dns 服务的 ClusterIP 地址。

由于 `(1)` 请求进入 `KUBE-SERVICE` 链，然后匹配规则 `(2)`，最后根据 `(3)` 的 random 随机模式，跳转到 (5) 或 (6) 条目，将请求 UDP 数据包的目标 IP 地址修改为 DNS 服务器的`实际` IP 地址，这是通过 `DNAT` 完成的。其中 `10.32.0.6` 和 `10.32.0.7` 是我们集群中 CoreDNS 的两个 Pod 副本的 IP 地址。

### 内核中的 DNAT

`DNAT` 的主要职责是同时更改传出数据包的目的地，响应数据包的源，并确保对所有后续数据包进行相同的修改。后者严重依赖于连接跟踪机制，也称为 `conntrack`，它被实现为内核模块。`conntrack` 会跟踪系统中正在进行的网络连接。

`conntrack` 中的每个连接都由两个元组表示，一个元组用于原始请求（IP_CT_DIR_ORIGINAL），另一个元组用于答复（IP_CT_DIR_REPLY）。对于 UDP，每个元组都由源 IP 地址，源端口以及目标 IP 地址和目标端口组成，答复元组包含存储在 src 字段中的目标的真实地址。

例如，如果 IP 地址为 `10.40.0.17` 的 Pod 向 kube-dns 的 ClusterIP 发送一个请求，该请求被转换为 `10.32.0.6`，则将创建以下元组：

```shell
原始：src = 10.40.0.17 dst = 10.96.0.10 sport = 53378 dport = 53
回复：src = 10.32.0.6 dst = 10.40.0.17 sport = 53 dport = 53378
```

通过这些条目内核可以相应地修改任何相关数据包的目的地和源地址，而无需再次遍历 DNAT 规则，此外，它将知道如何修改回复以及应将回复发送给谁。创建 `conntrack` 条目后，将首先对其进行确认，然后如果没有已确认的 `conntrack` 条目具有相同的原始元组或回复元组，则内核将尝试确认该条目。`conntrack` 创建和 DNAT 的简化流程如下所示：

![conntrack](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231114175844.png)

