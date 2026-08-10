---
title: "Kubernetes-CoreDNS"
published: 2023-11-09
description: "前面可以通过 Service 生成的 ClusterIP(VIP) 来访问 Pod 提供的服务，但是在使用的时候还有一个问题：怎么知道某个应用的 VIP 呢？有两个应用，一个是 api 应用，一个是 db 应用，两个应用都是通过 Deplo"
tags: ["Kubernetes"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

前面可以通过 Service 生成的 ClusterIP(VIP) 来访问 Pod 提供的服务，但是在使用的时候还有一个问题：怎么知道某个应用的 VIP 呢？有两个应用，一个是 api 应用，一个是 db 应用，两个应用都是通过 Deployment 进行管理的，并且都通过 Service 暴露出了端口提供服务。api 需要连接到 db 这个应用，现在只知道 db 应用的名称和 db 对应的 Service 的名称，但是并不知道它的 VIP 地址，前面的 Service 中通过 ClusterIP 就可以访问到后面的 Pod 服务，知道 VIP 的地址就可以了。

## 环境变量

为了解决上面的问题，在之前的版本中，Kubernetes 采用了环境变量的方法，每个 Pod 启动的时候，会通过环境变量设置所有服务的 IP 和 port 信息，这样 Pod 中的应用可以通过读取环境变量来获取依赖服务的地址信息，这种方法使用起来相对简单，但是有一个很大的问题就是依赖的服务必须在 Pod 启动之前就存在，不然是不会被注入到环境变量中的。比如首先创建一个 Nginx 服务：_test-nginx.yaml_

kubectl get pods -n default | grep Evicted | awk '{print$1}'| xargs kubectl delete -n default pods

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deploy
spec:
  replicas: 2
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
          image: nginx
          resources:
            limits:
              memory: "128Mi"
              cpu: "500m"
          ports:
            - containerPort: 80

---
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  selector:
    app: nginx
  ports:
    - port: 5000
      targetPort: 80
```

创建上面的服务：

```sh
kubectl apply -f test-nginx.yaml
```

![image-20231109111407293](https://blog.tianch.com.cn/img/20231109111409.png)

可以看到两个 Pod 和一个名为 nginx-service 的服务创建成功了，该 Service 监听的端口是 5000，同时它会把流量转发给它代理的所有 Pod（这里就是拥有 `app: nginx` 标签的两个 Pod）。

再来创建一个普通的 Pod，观察下该 Pod 中的环境变量是否包含上面的 `nginx-service` 的服务信息：_test-pod.yaml_

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
    - name: test-service-pod
      image: busybox
      command: ["/bin/sh", "-c", "env"]
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
```

然后创建该测试的 Pod 并随后查看日志信息:

```sh
kubectl apply -f test-pod.yaml
```

```sh
kubectl logs test-pod -n default
```

![image-20231109112149211](https://blog.tianch.com.cn/img/20231109112151.png)

可以看到打印了很多环境变量信息，其中就包括刚刚创建的 nginx-service 这个服务，有 HOST、PORT、PROTO、ADDR 等，也包括其他已经存在的 Service 的环境变量，如果现在需要在这个 Pod 里面访问 nginx-service 的服务，可以直接通过 `NGINX_SERVICE_SERVICE_HOST` 和 `NGINX_SERVICE_SERVICE_PORT` 就可以了，但是如果这个 Pod 启动起来的时候 nginx-service 服务还没启动起来，在环境变量中是无法获取到这些信息的，当然可以通过 `initContainer` 之类的方法来确保 nginx-service 启动后再启动 Pod，但是这种方法毕竟增加了 Pod 启动的复杂性，所以这不是最优的方法，局限性太多了。

## DNS

由于上面环境变量这种方式存在局限性，所以需要一种更加智能的方案，那就是直接使用 Service 的名称，因为 Service 的名称不会变化，不需要关心分配的 ClusterIP 的地址，因为这个地址并不是固定不变的，所以如果直接使用 Service 的名字，然后对应的 ClusterIP 地址的转换能够自动完成。它们之间的转换功能通过 DNS 就可以解决了，同样的，Kubernetes 也提供了 DNS 的方案来解决上面的服务发现的问题。

DNS 服务不是一个独立的系统服务，而是作为一种 addon 插件而存在，现在比较推荐的两个插件：kube-dns 和 CoreDNS，实际上在比较新点的版本中已经默认是 CoreDNS 了，因为 kube-dns 默认一个 Pod 中需要 3 个容器配合使用，CoreDNS 只需要一个容器即可，搭建集群的时候直接安装的就是 CoreDNS 插件：

```sh
kubectl get pods -n kube-system -l k8s-app=kube-dns
```

![image-20231109142312393](https://blog.tianch.com.cn/img/20231109142314.png)

CoreDns 是用 GO 写的高性能，高扩展性的 DNS 服务，基于 HTTP/2 Web 服务 Caddy 进行编写的。CoreDns 内部采用插件机制，所有功能都是插件形式编写，用户也可以扩展自己的插件，以下是 Kubernetes 部署 CoreDns 时的默认配置：

```yaml
apiVersion: v1
data:
  Corefile: |
    .:53 {
        errors     			# 启用错误记录
        health {				# 启用健康检查检查端点，8080:health
          lameduck 5s
        }
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {  # 处理 k8s 域名解析
          pods insecure
          fallthrough in-addr.arpa ip6.arpa
          ttl 30
        }
        prometheus :9153			# 启用 metrics 指标，9153:metrics
        forward . /etc/resolv.conf {  # 通过 resolv.conf 内的 nameservers 解析
          prefer_udp
          max_concurrent 1000
        }
        cache 30      # 通过 resolv.conf 内的 nameservers 解析
        loop					# 检查简单的转发循环并停止服务
        reload				# 运行自动重新加载 corefile，热更新
        loadbalance		# 负载均衡，默认 round_robin
    }
kind: ConfigMap
metadata:
  annotations:
    kubectl.kubernetes.io/last-applied-configuration: |
      {"apiVersion":"v1","data":{"Corefile":".:53 {\n    errors\n    health {\n      lameduck 5s\n    }\n    ready\n    kubernetes cluster.local in-addr.arpa ip6.arpa {\n      pods insecure\n      fallthrough in-addr.arpa ip6.arpa\n      ttl 30\n    }\n    prometheus :9153\n    forward . /etc/resolv.conf {\n      prefer_udp\n      max_concurrent 1000\n    }\n    cache 30\n    loop\n    reload\n    loadbalance\n}\n"},"kind":"ConfigMap","metadata":{"annotations":{},"labels":{"addonmanager.kubernetes.io/mode":"EnsureExists"},"name":"coredns","namespace":"kube-system"}}
  creationTimestamp: "2023-11-03T02:33:50Z"
  labels:
    addonmanager.kubernetes.io/mode: EnsureExists
  name: coredns
  namespace: kube-system
  resourceVersion: "273"
  uid: bdf90b96-0c07-45af-a119-818a51aae44b
```

- 每个 `{}` 代表一个 zone,格式是 `“Zone:port{}”`, 其中`"."`代表默认 zone
- `{}` 内的每个名称代表插件的名称，只有配置的插件才会启用，当解析域名时，会先匹配 zone（都未匹配会执行默认 zone），然后 zone 内的插件从上到下依次执行(这个顺序并不是配置文件内谁在前面的顺序，而是`core/dnsserver/zdirectives.go`内的顺序)，匹配后返回处理（执行过的插件从下到上依次处理返回逻辑），不再执行下一个插件

CoreDNS 的 Service 地址一般情况下是固定的，类似于 kubernetes 这个 Service 地址一般就是第一个 IP 地址 `169.254.25.1`，CoreDNS 的 Service 地址就是 `169.254.25.10`，该 IP 被分配后，kubelet 会将使用 `--cluster-dns=<dns-service-ip>` 参数配置的 DNS 传递给每个容器。DNS 名称也需要域名，本地域可以使用参数`--cluster-domain = <default-local-domain>` 在 kubelet 中配置：

```sh
cat /var/lib/kubelet/config.yaml
```

```yaml
......
clusterDNS:
- 169.254.25.10
clusterDomain: cluster.local
......
```

如果建立的 Service 如果支持域名形式进行解析，就可以解决服务发现的问题，那么利用 kubedns 可以将 Service 生成怎样的 DNS 记录呢？

- 普通的 Service：会生成 `servicename.namespace.svc.cluster.local` 的域名，会解析到 Service 对应的 ClusterIP 上，在 Pod 之间的调用可以简写成 `servicename.namespace`，如果处于同一个命名空间下面，甚至可以只写成 `servicename` 即可访问
- Headless Service：无头服务，就是把 clusterIP 设置为 None 的，会被解析为指定 Pod 的 IP 列表，同样还可以通过 `podname.servicename.namespace.svc.cluster.local` 访问到具体的某一个 Pod。

接下来使用一个简单 Pod 来测试下 Service 的域名访问：

```sh
kubectl run -it --image busybox test-dns --restart=Never --rm /bin/sh
```

![image-20231109143743544](https://blog.tianch.com.cn/img/20231109143745.png)

进入到 Pod 中，查看 `/etc/resolv.conf` 中的内容，可以看到 `nameserver` 的地址 `169.254.25.10`，该 IP 地址即是在安装 CoreDNS 插件的时候集群分配的一个固定的静态 IP 地址。

来访问下前面创建的 nginx-service 服务：

```shell
/ # wget -q -O- nginx-service.default.svc.cluster.local
```

![image-20231109144627763](https://blog.tianch.com.cn/img/image-20231109144627763.png)

可以看到上面使用 wget 命令去访问 nginx-service 服务的域名的时候连接拒绝了，没有得到期望的结果，这是因为上面建立 Service 的时候暴露的端口是 5000：

![image-20231109144655080](https://blog.tianch.com.cn/img/20231109144657.png)

加上 5000 端口，就正常访问到服务，再试一试访问：`nginx-service.default.svc`、`nginx-service.default`、`nginx-service`，不出意外这些域名都可以正常访问到期望的结果。

## 给 Pod 添加 DNS 记录

StatefulSet 中的 Pod 是拥有单独的 DNS 记录的，比如一个 StatefulSet 名称为 etcd，而它关联的 Headless SVC 名称为 etcd-headless，那么 CoreDNS 就会为它的每个 Pod 解析如下的记录：

```shell
etcd-0.etcd-headless.default.svc.cluster.local
etcd-1.etcd-headless.default.svc.cluster.local
......
```

那么除了 StatefulSet 管理的 Pod 之外，其他的 Pod 是否也可以生成 DNS 记录呢？

首先创建一个 Service ，其定义如下：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  selector:
    app: nginx
  clusterIP: None
  ports:
    - port: 80
```

创建service，并尝试解析 service DNS：

![image-20231109151130073](https://blog.tianch.com.cn/img/20231109151135.png)

```sh
dig @169.254.25.10 nginx.default.svc.cluster.local
```

提示没有dig命令的执行下面的命令安装即可:

```sh
yum install -y bind-utils
```

![image-20231109151413538](https://blog.tianch.com.cn/img/20231109151415.png)

然后对 nginx 的 FQDN 域名进行 dig 操作，可以看到返回了多条 A 记录，每一条对应一个 Pod。

接下来试试在 service 名字前面加上 Pod 名字交给 kube-dns 做解析：

```sh
dig @169.254.25.10 nginx-deploy-67d4bdd6f5-n2ff5.nginx.default.svc.cluster.local
```

![image-20231109152820900](https://blog.tianch.com.cn/img/20231109152824.png)

可以看到并没有得到解析结果。官方文档中有一段 `Pod’s hostname and subdomain fields` 说明：

> Pod 规范中包含一个可选的 hostname 字段，可以用来指定 Pod 的主机名。当这个字段被设置时，它将优先于 Pod 的名字成为该 Pod 的主机名。举个例子，给定一个 hostname 设置为 "my-host" 的 Pod， 该 Pod 的主机名将被设置为 "my-host"。Pod 规约还有一个可选的 subdomain 字段，可以用来指定 Pod 的子域名。举个例子，某 Pod 的 hostname 设置为 “foo”，subdomain 设置为 “bar”， 在名字空间 “my-namespace” 中对应的完全限定域名为 “foo.bar.my-namespace.svc.cluster-domain.example”。

现在编辑一下 nginx.yaml 加上 subdomain 测试下看看：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deploy
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      subdomain: nginx
      containers:
        - name: nginx
          image: nginx
          resources:
            limits:
              memory: "128Mi"
              cpu: "500m"
          ports:
            - containerPort: 80
```

![image-20231109153318014](https://blog.tianch.com.cn/img/20231109153320.png)

可以看到依然不能解析，那就试试官方文档中的例子 ，不用 Deployment 直接创建 Pod 吧。第一步先将 hostname 和 subdomain 注释掉：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: default-subdomain
spec:
  selector:
    name: busybox
  clusterIP: None
  ports:
    - name: foo # Actually, no port is needed.
      port: 1234
      targetPort: 1234
---
apiVersion: v1
kind: Pod
metadata:
  name: busybox1
  labels:
    name: busybox
spec:
  hostname: busybox-1
  subdomain: default-subdomain
  containers:
    - image: busybox:1.28
      command:
        - sleep
        - "3600"
      name: busybox
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
---
apiVersion: v1
kind: Pod
metadata:
  name: busybox2
  labels:
    name: busybox
spec:
  hostname: busybox-2
  subdomain: default-subdomain
  containers:
    - image: busybox:1.28
      command:
        - sleep
        - "3600"
      name: busybox
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
```

部署然后尝试解析 Pod DNS (注意这里 hostname 和 pod的name有区别，中间多了减号)：

```sh
dig @169.254.25.10 busybox-1.default-subdomain.default.svc.cluster.local
```

![image-20231109154104935](https://blog.tianch.com.cn/img/20231109154106.png)

现在看到有 ANSWER 记录回来了，hostname 和 subdomain 二者都必须显式指定，缺一不可。一开始的截图中的实现方式其实也是这种方式。

现在我们一下之前的 nginx deployment 加上 hostname，重新解析：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deploy
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      hostname: nginx
      subdomain: nginx
      containers:
        - name: nginx
          image: nginx
          resources:
            limits:
              memory: "128Mi"
              cpu: "500m"
          ports:
            - containerPort: 80

---
apiVersion: v1
kind: Service
metadata:
  name: nginx
spec:
  selector:
    app: nginx
  type: ClusterIP
  clusterIP: None
  ports:
    - port: 80
```

```sh
dig @169.254.25.10 nginx.nginx.default.svc.cluster.local
```

![image-20231109161815082](https://blog.tianch.com.cn/img/20231109161816.png)

可以看到解析成功了，但是因为 Deployment 中无法给每个 Pod 指定不同的 hostname，所以两个 Pod 有同样的 hostname，解析出来两个 IP，跟本意就不符合了。不过知道了这种方式过后就可以自己去写一个 Operator 去直接管理 Pod 了，给每个 Pod 设置不同的 hostname 和一个 Headless SVC 名称的 subdomain，这样就相当于实现了 StatefulSet 中的 Pod 解析。

## Pod的DNS策略

DNS 策略可以单独对 Pod 进行设定，目前 Kubernetes 支持以下特定 Pod 的 DNS 策略。这些策略可以在 Pod 规范中的 `dnsPolicy` 字段设置：

- Default: 有人说 Default 的方式，是使用宿主机的方式，这种说法并不准确。这种方式其实是让 kubelet 来决定使用何种 DNS 策略。而 kubelet 默认的方式，就是使用宿主机的 `/etc/resolv.conf`（可能这就是有人说使用宿主机的 DNS 策略的方式吧），但是，kubelet 是可以灵活来配置使用什么文件来进行 DNS 策略的，完全可以使用 kubelet 的参数 `–resolv-conf=/etc/resolv.conf` 来决定 DNS 解析文件地址。
- ClusterFirst: 这种方式，表示 Pod 内的 DNS 使用集群中配置的 DNS 服务，简单来说，就是使用 Kubernetes 中 kubedns 或 coredns 服务进行域名解析。如果解析不成功，才会使用宿主机的 DNS 配置进行解析。
- ClusterFirstWithHostNet：在某些场景下，Pod 是用 HostNetwork 模式启动的，一旦用 HostNetwork 模式，表示这个 Pod 中的所有容器，都要使用宿主机的 `/etc/resolv.conf` 配置进行 DNS 查询，但如果还想继续使用 Kubernetes 的 DNS 服务，那就将 dnsPolicy 设置为 `ClusterFirstWithHostNet`。
- None: 表示空的 DNS 设置，这种方式一般用于想要自定义 DNS 配置的场景，往往需要和 `dnsConfig` 配合一起使用达到自定义 DNS 的目的。

> 需要注意的是 `Default` 并不是默认的 DNS 策略，如果未明确指定 dnsPolicy，则使用 `ClusterFirst`。

下面的示例显示了一个 Pod，其 DNS 策略设置为 `ClusterFirstWithHostNet`，因为它已将 hostNetwork 设置为 true。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: busybox
  namespace: default
spec:
  containers:
    - image: busybox
      command:
        - sleep
        - "3600"
      imagePullPolicy: IfNotPresent
      name: busybox
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
  restartPolicy: Always
  hostNetwork: true
  dnsPolicy: ClusterFirstWithHostNet
```

## Pod 的 DNS 配置

Pod 的 DNS 配置可让用户对 Pod 的 DNS 设置进行更多控制。`dnsConfig` 字段是可选的，它可以与任何 `dnsPolicy` 设置一起使用。 但是，**当 Pod 的 dnsPolicy 设置为 "None" 时，必须指定 dnsConfig 字段**。

用户可以在 dnsConfig 字段中指定以下属性：

- nameservers：将用作于 Pod 的 DNS 服务器的 IP 地址列表。 最多可以指定 3 个 IP 地址。当 Pod 的 dnsPolicy 设置为 "None" 时，列表必须至少包含一个 IP 地址，否则此属性是可选的。所列出的服务器将合并到从指定的 DNS 策略生成的基本名称服务器，并删除重复的地址。
- searches：用于在 Pod 中查找主机名的 DNS 搜索域的列表。此属性是可选的。 指定此属性时，所提供的列表将合并到根据所选 DNS 策略生成的基本搜索域名中。重复的域名将被删除，Kubernetes 最多允许 6 个搜索域。
- options：可选的对象列表，其中每个对象可能具有 name 属性（必需）和 value 属性（可选）。此属性中的内容将合并到从指定的 DNS 策略生成的选项。重复的条目将被删除。

以下是具有自定义 DNS 设置的 Pod 示例：

```yaml
apiVersion: v1
kind: Pod
metadata:
  namespace: default
  name: dns-example
spec:
  containers:
    - name: test
      image: nginx
      resources:
        limits:
          memory: "64Mi"
          cpu: "250m"
  dnsPolicy: "None"

  dnsConfig:
    nameservers:
      - 1.2.3.4
    searches:
      - ns1.svc.cluster-domain.example
      - my.dns.search.suffix
    options:
      - name: ndots
        value: "2"
      - name: edns0
```

创建上面的 Pod 后，容器 test 会在其 `/etc/resolv.conf` 文件中获取以下内容：

```shell
nameserver 1.2.3.4
search ns1.svc.cluster-domain.example my.dns.search.suffix
options ndots:2 edns0
```

