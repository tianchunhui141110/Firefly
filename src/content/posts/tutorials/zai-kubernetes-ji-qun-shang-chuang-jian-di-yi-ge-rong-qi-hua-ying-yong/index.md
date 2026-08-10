---
title: "在Kubernetes集群上创建第一个容器化应用"
published: 2023-10-16
description: "Kubernetes 集群已经搭建成功了，现在就可以在集群里面来跑应用了。要在集群里面运行应用，首先需要知道几个概念。"
tags: ["Kubernetes","集群"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

## YAML 资源清单文件

Kubernetes 集群已经搭建成功了，现在就可以在集群里面来跑应用了。要在集群里面运行应用，首先需要知道几个概念。

第一个是应用的镜像，因为在集群中运行的是容器，所以首先需要将应用打包成镜像。镜像准备好了，Kubernetes 集群也准备好了，就可以把应用部署到集群中了。但是镜像到集群中运行这个过程如何完成呢？必然有一个地方可以来描述我们的应用，然后把这份描述告诉集群，然后集群按照这个描述来部署应用。

在之前 Docker 环境下面是直接通过命令 `docker run` 来运行应用的，在 Kubernetes 环境下面同样也可以用类似 `kubectl run` 这样的命令来运行应用，但是在 Kubernetes 中却是不推荐使用命令行的方式，而是希望使用称为**资源清单**的东西来描述应用，资源清单可以用 YAML 或者 JSON 文件来编写，一般来说 YAML 文件更方便阅读和理解。

通过一个资源清单文件来定义好一个应用后，就可以通过 kubectl 工具来直接运行它：

```shell
kubectl create -f xxxx.yaml
```

kubectl 是直接操作 APIServer 的，所以就相当于把资源清单提交给了 APIServer，然后集群获取到清单描述的应用信息后存入到 etcd 数据库中，然后 `kube-scheduler` 组件发现这个时候有一个 Pod 还没有绑定到节点上，就会对这个 Pod 进行一系列的调度，把它调度到一个最合适的节点上，然后把这个节点和 Pod 绑定到一起（写回到 etcd），然后节点上的 kubelet 组件这个时候 watch 到有一个 Pod 被分配过来了，就去把这个 Pod 的信息拉取下来，然后根据描述通过容器运行时把容器创建出来，最后当然同样把 Pod 状态再写回到 etcd 中去，这样就完成了一整个的创建流程。

## 第一个容器化应用

通过 YAML 文件编写了一个如下的资源清单，命名为 first-demo.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deploy
  labels:
    chapter: first-app
spec:
  selector:
    matchLabels:
      app: nginx
  replicas: 2
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.20
```

应用yaml文件

```sh
kubectl apply -f first-demo.yaml
```

查看创建的pod

```sh
kubectl get pod -n default
```

根据标签查看创建的pod

```sh
kubectl get pod -l app=nginx -n default
```

根据标签查看创建的deployment

```sh
kubectl get deployment -l chapter=first-app -n default
```

![image-20231016174103937](https://blog.tianch.com.cn/img/image-20231016174103937-1697449278698-1.png)

查看某一个pod的详细信息

```sh
kubectl describe pod nginx-deploy-6d777db949-22r26 -n default
```

```
[C:\~]$ kubectl describe pod nginx-deploy-6d777db949-22r26 -n default
Name:             nginx-deploy-6d777db949-22r26
Namespace:        default
Priority:         0
Service Account:  default
Node:             node2/10.168.1.22
Start Time:       Mon, 16 Oct 2023 17:12:42 +0800
Labels:           app=nginx
                  pod-template-hash=6d777db949
Annotations:      cni.projectcalico.org/containerID: e46e5e8727a8c9bc31eef509b627035a6139dfbd60bc99dd0b23cb6483bfae30
                  cni.projectcalico.org/podIP: 10.233.96.30/32
                  cni.projectcalico.org/podIPs: 10.233.96.30/32
Status:           Running
IP:               10.233.96.30
IPs:
  IP:           10.233.96.30
Controlled By:  ReplicaSet/nginx-deploy-6d777db949
Containers:
  nginx:
    Container ID:   containerd://868fe141d9e9caf702df468e792288138a94c0110029f8908874abbb6d25e9d1
    Image:          nginx:1.20
    Image ID:       docker.io/library/nginx@sha256:38f8c1d9613f3f42e7969c3b1dd5c3277e635d4576713e6453c6193e66270a6d
    Port:           <none>
    Host Port:      <none>
    State:          Running
      Started:      Mon, 16 Oct 2023 17:13:31 +0800
    Ready:          True
    Restart Count:  0
    Environment:    <none>
    Mounts:
      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-96zwq (ro)
Conditions:
  Type              Status
  Initialized       True
  Ready             True
  ContainersReady   True
  PodScheduled      True
Volumes:
  kube-api-access-96zwq:
    Type:                    Projected (a volume that contains injected data from multiple sources)
    TokenExpirationSeconds:  3607
    ConfigMapName:           kube-root-ca.crt
    ConfigMapOptional:       <nil>
    DownwardAPI:             true
QoS Class:                   BestEffort
Node-Selectors:              <none>
Tolerations:                 node.kubernetes.io/not-ready:NoExecute op=Exists for 300s
                             node.kubernetes.io/unreachable:NoExecute op=Exists for 300s
Events:
  Type     Reason       Age   From               Message
  ----     ------       ----  ----               -------
  Normal   Scheduled    27m   default-scheduler  Successfully assigned default/nginx-deploy-6d777db949-22r26 to node2
  Warning  FailedMount  27m   kubelet            MountVolume.SetUp failed for volume "kube-api-access-96zwq" : failed to sync configmap cache: timed out waiting for the condition
  Normal   Pulling      27m   kubelet            Pulling image "nginx:1.20"
  Normal   Pulled       27m   kubelet            Successfully pulled image "nginx:1.20" in 46.065135121s
  Normal   Created      27m   kubelet            Created container nginx
  Normal   Started      27m   kubelet            Started container nginx
```

可以看到看到很多这个 Pod 的详细信息，比如调度到的节点、状态、IP 等，一般比较关心的是下面的 `Events` 部分，就是我们说的**事件**。

在 Kubernetes 创建资源对象的过程中，对该对象的一些重要操作，都会被记录在这个对象的 `Events` 里面，可以通过 `kubectl describe` 指令查看对应的结果。所以这个指令也会是以后排错过程中会经常使用的命令。比如上面描述的这个 Pod，可以看到它被创建之后，被调度器调度（Successfully assigned）到了 node2 节点上，然后指定的镜像在该节点上不存在，然后去拉取镜像，然后创建我们定义的 nginx 容器，最后启动定义的容器。

另外一个方面如果应用进行升级的话应该怎么办呢？这个操作在我们日常工作中还是非常常见的，而在 Kubernetes 里也是非常简单的，只需要修改资源清单文件即可，比如把镜像升级到最新版本 `nginx:latest`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deploy
  labels:
    chapter: first-app
spec:
  selector:
    matchLabels:
      app: nginx
  replicas: 2
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:latest # 这里被从 1.20 修改为latest
```

可以通过`kubectl apply`命令来直接更新，这个命令也是推荐使用的，不必关心当前的操作是创建还是更新，执行的命令始终是 `kubectl apply`，Kubernetes 则会根据 YAML 文件的内容变化，自动进行具体的处理，所以无论是创建还是更新都可以直接使用这个命令

```sh
kubectl apply -f first-demo.yaml
```

命令就可以来更新应用了，由于这里使用的是一个 Deployment 的控制器，所以会滚动更新应用，可以通过在命令后面加上 `--watch` 参数来查看 Pod 的更新过程,过程是从下往上看

```sh
kubectl get pods -l app=nginx -n default --watch
```

![image-20231016175247637](https://blog.tianch.com.cn/img/image-20231016175247637.png)

更新过程是先杀掉了一个 Pod，然后又重新创建了一个新的 Pod，然后又杀掉一个旧的 Pod，再创建一个新的 Pod，这样交替替换的，最后剩下两个新的 Pod，这就是滚动更新，滚动更新对于应用持续提供服务是非常重要的手段，在日常工作中更新应用肯定会采用这种方式。

最后，如果需要把应用从集群中删除掉，可以用 `kubectl delete` 命令来清理

```sh
kubectl delete -f first-demo.yaml
```

