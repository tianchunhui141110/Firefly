---
title: "Kubernetes-Service"
published: 2023-11-07
description: "每个 Pod 都有自己的 IP 地址，但是如果 Pod 重建了的话 IP 很有可能也就变化了。这就会带来一个问题：比如有一些后端的 Pod 集合为集群中的其他应用提供 API 服务，在前端应用中把所有的这些后端的 Pod 的地址都写死，然后"
tags: ["Kubernetes"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

每个 Pod 都有自己的 IP 地址，但是如果 Pod 重建了的话 IP 很有可能也就变化了。这就会带来一个问题：比如有一些后端的 Pod 集合为集群中的其他应用提供 API 服务，在前端应用中把所有的这些后端的 Pod 的地址都写死，然后以某种方式去访问其中一个 Pod 的服务，这样看上去是可以工作的，但是如果这个 Pod 挂掉了，然后重新启动起来了，IP 地址就变了，这个时候前端就访问不到后端的服务了。

在没有使用 Kubernetes 之前，不一定是 IP 变化的问题，比如在部署一个 WEB 服务的时候，前端一般部署一个 Nginx 作为服务的入口，然后 Nginx 后面肯定就是挂载的这个服务的大量后端服务，很早以前是去手动更改 Nginx 配置中的 upstream 选项，来动态改变提供服务的数量，到后面出现了一些服务发现的工具，比如 Consul、ZooKeeper 等工具，有了这些工具过后就可以只需要把服务注册到这些服务发现中心去就可以，然后让这些工具动态的去更新 Nginx 的配置就可以了，完全不用去手工的操作了。

要解决上面遇到的问题实现一个服务发现的工具也可以解决，当我们 Pod 被销毁或者新建过后，可以把这个 Pod 的地址注册到这个服务发现中心去就可以了，但是这样的话前端应用就不能直接去连接后台的 Pod 集合了，应该连接到一个能够做服务发现的中间件上面。

为解决这个问题 Kubernetes 就提供了这样的一个对象 - Service，Service 是一种抽象的对象，它定义了一组 Pod 的逻辑集合和一个用于访问它们的策略，其实这个概念和微服务非常类似。一个 Serivce 下面包含的 Pod 集合是由 Label Selector 来决定的。

假如我们后端运行了 3 个副本，这些副本都是可以替代的，因为前端并不关心它们使用的是哪一个后端服务。尽管由于各种原因后端的 Pod 集合会发生变化，但是前端并不需要知道这些变化，也不需要自己用一个列表来记录这些后端的服务，Service 的这种抽象就可以达到这种解耦的目的。

## 三种IP

在学习 Service 之前，需要先弄明白 Kubernetes 系统中的三种 IP:

- Node IP：Node 节点的 IP 地址
- Pod IP: Pod 的 IP 地址
- Cluster IP: Service 的 IP 地址

Node IP 是 Kubernetes 集群中节点的物理网卡 IP 地址(一般为内网)，所有属于这个网络的服务器之间都可以直接通信，所以 Kubernetes 集群外要想访问 Kubernetes 集群内部的某个节点或者服务，肯定得通过 Node IP 进行通信（这个时候一般是通过外网 IP 访问）

Pod IP 是每个 Pod 的 IP 地址，它是网络插件进行分配的

Cluster IP 是一个虚拟的 IP，仅仅作用于 Kubernetes Service 这个对象，由 Kubernetes 自己来进行管理和分配地址

## 定义Service

定义 Service 的方式和前面定义的各种资源对象的方式类似：有一组 Pod 服务，它们对外暴露了 8080 端口，同时都被打上了 app=myapp 这样的标签，就可以像下面这样来定义一个 Service 对象：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp
  ports:
    - port: 80
      targetPort: 8080
      name: myapp-http
      protocol: TCP
```

通过使用 `kubectl create -f myservice.yaml` 就可以创建一个名为 myservice 的 Service 对象，它会将请求代理到使用 TCP 端口为 8080，具有标签 `app=myapp` 的 Pod 上，这个 Service 会被系统分配一个 Cluster IP，该 Service 还会持续的监听 selector 下面的 Pod，会把这些 Pod 信息更新到一个名为 myservice 的 Endpoints 对象上去，这个对象就类似于上面说的 Pod 集合了。

需要注意的是，Service 能够将一个接收端口映射到任意的 targetPort。默认情况下，targetPort 将被设置为与 port 字段相同的值。更有趣的是，targetPort 可以是一个字符串，引用了 backend Pod 的一个端口的名称。因实际指派给该端口名称的端口号，在每个 backend Pod 中可能并不相同，所以对于部署和设计 Service，这种方式会提供更大的灵活性。

另外 Service 能够支持 TCP 和 UDP 协议，默认是 TCP 协议。

## kube-proxy

在 Kubernetes 集群中，每个 Node 会运行一个 kube-proxy 进程, 负责为 Service 实现一种 VIP（虚拟 IP，就是上面说的 clusterIP）的代理形式，现在的 Kubernetes 中默认是使用的 iptables 这种模式来代理。

### iptables

这种模式，kube-proxy 会 watch apiserver 对 Service 对象和 Endpoints 对象的添加和移除。对每个 Service，它会添加上 iptables 规则，从而捕获到达该 Service 的 clusterIP（虚拟 IP）和端口的请求，进而将请求重定向到 Service 的一组 backend 中的某一个 Pod 上面。还可以使用 `Pod readiness 探针` 验证后端 Pod 可以正常工作，以便 iptables 模式下的 kube-proxy 仅看到测试正常的后端，这样做意味着可以避免将流量通过 `kube-proxy` 发送到已知失败的 Pod 中，所以对于线上的应用来说一定要做 readiness 探针。

![service iptables](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231107154655.png)

iptables 模式的 kube-proxy 默认的策略，随机选择一个后端 Pod。

比如当创建 backend Service 时，Kubernetes 会给它指派一个虚拟 IP 地址，比如 10.0.0.1。假设 Service 的端口是 1234，该 Service 会被集群中所有的 kube-proxy 实例观察到。当 kube-proxy 看到一个新的 Service，它会安装一系列的 iptables 规则，从 VIP 重定向到 `per-Service` 规则。 该 `per-Service` 规则连接到 `per-Endpoint` 规则，该 `per-Endpoint` 规则会重定向（目标 `NAT`）到后端的 Pod。

### ipvs

除了 iptables 模式之外，kubernetes 也支持 ipvs 模式，在 ipvs 模式下，kube-proxy watch Kubernetes 服务和端点，调用 `netlink` 接口相应地创建 IPVS 规则， 并定期将 IPVS 规则与 Kubernetes 服务和端点同步。该控制循环可确保 IPVS 状态与所需状态匹配。访问服务时，IPVS 　将流量定向到后端 Pod 之一。

IPVS 代理模式基于类似于 iptables 模式的 netfilter 钩子函数，但是使用**哈希表**作为基础数据结构，并且在内核空间中工作。 所以与 iptables 模式下的 kube-proxy 相比，IPVS 模式下的 kube-proxy 重定向通信的延迟要短，并且在同步代理规则时具有更好的性能。与其他代理模式相比，IPVS 模式还支持更高的网络流量吞吐量。所以对于较大规模的集群会使用 ipvs 模式的 kube-proxy，只需要满足节点上运行 ipvs 的条件，就可以直接将 kube-proxy 的模式修改为 ipvs，如果不满足运行条件会自动降级为 iptables 模式，现在都推荐使用 ipvs 模式，可以大幅度提高 Service 性能。

IPVS 提供了更多选项来平衡后端 Pod 的流量，默认是 `rr`，有如下一些策略：

- rr: round-robin
- lc: least connection (smallest number of open connections)
- dh: destination hashing
- sh: source hashing
- sed: shortest expected delay
- nq: never queue

不过现在只能整体修改策略，可以通过 kube-proxy 中配置 `–ipvs-scheduler` 参数来实现，暂时不支持特定的 Service 进行配置。

![service ipvs](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231107155522.png)

也可以实现基于客户端 IP 的会话亲和性，可以将 service.spec.sessionAffinity 的值设置为 "ClientIP" （默认值为 "None"）即可，此外还可以通过适当设置 `service.spec.sessionAffinityConfig.clientIP.timeoutSeconds` 来设置最大会话停留时间（默认值为 10800 秒，即 3 小时）:

```yaml
apiVersion: v1
kind: Service
spec:
  sessionAffinity: ClientIP
  ...
```

**亲和性：**Service 只支持两种形式的会话亲和性服务：None 和 ClientIP，不支持基于 cookie 的会话亲和性，这是因为 Service 不是在 HTTP 层面上工作的，处理的是 TCP 和 UDP 包，并不关心其中的载荷内容，因为 cookie 是 HTTP 协议的一部分，Service 并不知道它们，所有会话亲和性不能基于Cookie。

## Service

在定义 Service 的时候可以指定一个自己需要的类型的 Service，如果不指定的话默认是 `ClusterIP`类型。

可以使用的服务类型如下：

- ClusterIP：通过集群的内部 IP 暴露服务，服务只能够在集群内部可以访问，这也是默认的服务类型。
- NodePort：通过**每个 Node 节点**上的 IP 和静态端口（NodePort）暴露服务。NodePort 服务会路由到 ClusterIP 服务，这个 ClusterIP 服务会自动创建。通过请求 `NodeIp:NodePort`，可以从集群的外部访问一个 NodePort 服务。
- LoadBalancer：使用云提供商的负载均衡器，可以向外部暴露服务。外部的负载均衡器可以路由到 NodePort 服务和 ClusterIP 服务，这个需要结合具体的云厂商进行操作。
- ExternalName：通过返回 `CNAME` 和它的值，可以将服务映射到 `externalName` 字段的内容（例如， foo.bar.example.com）。

### NodePort 类型

如果设置 type 的值为 `NodePort`，Kubernetes master 将从给定的配置范围内（默认：30000-32767）分配端口，每个 Node 将从该端口（每个 Node 上的同一端口）代理到 Service。该端口将通过 Service 的 `spec.ports[*].nodePort` 字段被指定，如果不指定的话会自动生成一个端口。

需要注意的是，Service 将能够通过 `spec.ports[].nodePort` 和 `spec.clusterIp:spec.ports[].port` 而对外可见。

创建一个 NodePort 的服务来访问前面的 Nginx 服务：_service-nodeport-demo.yaml_

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myservice
spec:
  selector:
    app: myapp
  type: NodePort
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
      name: myapp-http
```

![image-20231107172049567](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231107172051.png)

可以看到 myservice 的 TYPE 类型已经变成了 NodePort，后面的 PORT(S) 部分也多了一个 30864的映射端口。

### ExternalName

ExternalName 是 Service 的特例，它没有 `selector`，也没有定义任何的端口和 Endpoint。对于运行在集群外部的服务，它通过返回该外部服务的别名来提供服务。

```yaml
kind: Service
apiVersion: v1
metadata:
  name: my-service
  namespace: prod
spec:
  type: ExternalName
  externalName: my.database.example.com
```

当访问地址 `my-service.prod.svc.cluster.local`时，集群的 DNS 服务将返回一个值为 my.database.example.com 的 `CNAME` 记录。访问这个服务的工作方式与其它的相同，唯一不同的是重定向发生在 DNS 层，而且不会进行代理或转发。如果后续决定要将数据库迁移到 Kubernetes 集群中，可以启动对应的 Pod，增加合适的 Selector 或 Endpoint，修改 Service 的 type，完全不需要修改调用的代码，这样就完全解耦了。

除了可以直接通过 `externalName` 指定外部服务的域名之外，还可以通过自定义 Endpoints 来创建 Service，前提是 `clusterIP=None`，名称要和 Service 保持一致，如下所示：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: etcd-k8s
  namespace: kube-system
  labels:
    k8s-app: etcd
spec:
  type: ClusterIP
  clusterIP: None
  ports:
    - name: port
      port: 2379

---
apiVersion: v1
kind: Endpoints
metadata:
  name: etcd-k8s # 名称必须和 Service 一致
  namespace: kube-system
  labels:
    k8s-app: etcd
subsets:
  - addresses:
      - ip: 10.168.1.20 # Service 将连接重定向到 endpoint
    ports:
      - name: port
        port: 2379 # endpoint 的目标端口
```

上面这个服务就是将外部的 etcd 服务引入到 Kubernetes 集群中来。

## externalIPs

Service 的属性中还有一个 `externalIPs` 的属性，从 Kubernetes 官网文档可以看到该属性的相关描述：

> 如果外部的 IP 路由到集群中一个或多个 Node 上，Kubernetes Service 会被暴露给这些 `externalIPs`。通过外部 IP（作为目的 IP 地址）进入到集群，传到 Service 的端口上的流量，将会被路由到 Service 的 Endpoint 上，`externalIPs` 不会被 Kubernetes 管理，它属于集群管理员的职责范畴。

这里最重要的一点就是确保使用哪个 IP 来访问 Kubernetes 集群，使用外部 IP Service 类型，我们可以将 Service 绑定到连接集群的 IP。

> 参考文档：https://www.fadhil-blog.dev/blog/kubernetes-external-ip/

## 获取客户端 IP

通常，当集群内的客户端连接到服务的时候，是支持服务的 Pod 可以获取到客户端的 IP 地址的，但是，当通过节点端口接收到连接时，由于对数据包执行了源网络地址转换（SNAT），因此数据包的源 IP 地址会发生变化，后端的 Pod 无法看到实际的客户端 IP，对于某些应用来说是个问题，比如，nginx 的请求日志就无法获取准确的客户端访问 IP 了，比如下面我们的应用：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.7.9
          ports:
            - containerPort: 80
          resources:
            limits:
              cpu: "300m"
              memory: "128Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: nginx
spec:
  selector:
    app: nginx
  type: NodePort
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
```

直接创建后可以查看 nginx 服务被自动分配了一个 31320 的 NodePort 端口：

![image-20231107174110630](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231107174112.png)

![image-20231107174532719](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231107174534.png)

可以看到这个 3 个 Pod 被分配到了 3 个不同的节点，这个时候通过 master 节点的 NodePort 端口来访问下我们的服务，这个时候我们查看 nginx 的 Pod 日志可以看到其中获取到的 clientIP 是 `10.233.70.0`，其实是 master 节点的某一个内网 IP，并不是我们期望的真正的浏览器端访问的 IP 地址：

![image-20231107175132043](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231107175134.png)

这是因为 master 节点上并没有对应的 Pod，所以通过 master 节点去访问应用的时候必然需要额外的网络跳转才能到达其他节点上 Pod，在跳转过程中由于对数据包进行了 SNAT，所以看到的是 master 节点的 IP。这个时候可以在 Service 设置 `externalTrafficPolicy` 来减少网络跳数：

```yaml
spec:
  externalTrafficPolicy: Local
```

如果 Service 中配置了 `externalTrafficPolicy=Local`，并且通过服务的节点端口来打开外部连接，则 Service 会代理到本地运行的 Pod，如果本地没有本地 Pod 存在，则连接将挂起，这里设置上该字段更新，这个时候通过 master 节点的 NodePort 访问应用是访问不到的，因为 master 节点上并没有对应的 Pod 运行，所以需要确保负载均衡器将连接转发给至少具有一个 Pod 的节点。

但是需要注意的是使用这个参数有一个缺点，通常情况下，请求都是均匀分布在所有 Pod 上的，但是使用了这个配置的话，情况就有可能不一样了。比如有两个节点上运行了 3 个 Pod，假如节点 A 运行一个 Pod，节点 B 运行两个 Pod，如果负载均衡器在两个节点间均衡分布连接，则节点 A 上的 Pod 将接收到所有请求的 50%，但节点 B 上的两个 Pod 每个Pod就只接收 25% 。

由于增加了`externalTrafficPolicy: Local`这个配置后，接收请求的节点和目标 Pod 都在一个节点上，所以没有额外的网络跳转（不执行 SNAT），所以就可以拿到正确的客户端 IP，如下所示把 Pod 都固定到 master 节点上：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      tolerations:
        - operator: "Exists"
      nodeSelector:
        kubernetes.io/hostname: master
      containers:
        - name: nginx
          image: nginx
          ports:
            - containerPort: 80
          resources:
            limits:
              cpu: "300m"
              memory: "128Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: nginx
spec:
  externalTrafficPolicy: Local
  selector:
    app: nginx
  type: NodePort
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
```

![image-20231107180621543](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231107180623.png)

更新服务后，然后再通过 NodePort 访问服务可以看到拿到的就是正确的客户端 IP 地址了：

![image-20231107180737257](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231107180738.png)

