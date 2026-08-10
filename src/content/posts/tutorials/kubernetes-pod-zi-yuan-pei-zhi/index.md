---
title: "Kubernetes-Pod资源配置"
published: 2026-01-05
description: "实际上上面几个步骤就是影响一个 Pod 生命周期的大的部分，但是还有一些细节也会在 Pod 的启动过程进行设置，比如在容器启动之前还会为当前的容器设置分配的 CPU、内存等资源，可以通过 CGroup 来对容器的资源进行限制，同样的，在 P"
tags: ["Kubernetes"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

实际上上面几个步骤就是影响一个 Pod 生命周期的大的部分，但是还有一些细节也会在 Pod 的启动过程进行设置，比如在容器启动之前还会为当前的容器设置分配的 CPU、内存等资源，可以通过 CGroup 来对容器的资源进行限制，同样的，在 Pod 中也可以直接配置某个容器的使用的 CPU 或者内存的上限。那么 Pod 是如何来使用和控制这些资源的分配的呢？

首先对于 CPU，计算机里 CPU 的资源是按`“时间片”`的方式来进行分配的，系统里的每一个操作都需要 CPU 的处理，所以，哪个任务要是申请的 CPU 时间片越多，那么它得到的 CPU 资源就越多，这个很容器理解。

然后还需要了解下 CGroup 里面对于 CPU 资源的单位换算：

```shell
1 CPU =  1000 millicpu（1 Core = 1000m）
0.5 CPU = 500 millicpu （0.5 Core = 500m）
```

这里的 `m` 就是毫、毫核的意思，Kubernetes 集群中的每一个节点可以通过操作系统的命令来确认本节点的 CPU 内核数量，然后将这个数量乘以1000，得到的就是节点总 CPU 总毫数。比如一个节点有四核，那么该节点的 CPU 总毫量为 4000m，如果你要使用0.5 core，则你要求的是 4000\*0.5 = 2000m。在 Pod 里面我们可以通过下面的两个参数来限制和请求 CPU 资源：

- `spec.containers[].resources.limits.cpu`：CPU 上限值，可以短暂超过，容器也不会被停止
- `spec.containers[].resources.requests.cpu`：CPU请求值，Kubernetes 调度算法里的依据值，可以超过

这里需要明白的是，如果 `resources.requests.cpu` 设置的值大于集群里每个节点的最大 CPU 核心数，那么这个 Pod 将无法调度，因为没有节点能满足它。

到这里应该明白了，`requests` 是用于集群调度使用的资源，而 `limits` 才是真正的用于资源限制的配置，如果需要保证的你应用优先级很高，也就是资源吃紧的情况下最后再杀掉你的 Pod，那么你就把 requests 和 limits 的值设置成一致。

定义一个 Pod，给容器的配置如下的资源:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: resource-demo1
spec:
  containers:
    - name: resource-demo1
      image: nginx
      ports:
        - containerPort: 80
      resources:
        requests:
          memory: 50Mi
          cpu: 50m
        limits:
          memory: 100Mi
          cpu: 100m
```

这里，CPU 给的是 50m，也就是 `0.05core`，这 `0.05core` 也就是占了 1 CPU 里的 5% 的资源时间。而限制资源是给的是 100m，但是需要注意的是 CPU 资源是可压缩资源，也就是容器达到了这个设定的上限后，容器性能会下降，但是不会终止或退出。比如直接创建上面这个 Pod：

```sh
kubectl apply -f pod-resource-demo1.yaml
```

创建完成后，我们可以看到 Pod 被调度到 node2 这个节点上：

```sh
[root@master ~]# kubectl get pods -n default -o wide
NAME             READY   STATUS    RESTARTS   AGE     IP              NODE    NOMINATED NODE   READINESS GATES
resource-demo1   1/1     Running   0          2m34s   10.233.96.108   node2   <none>           <none>
```

然后我们到 node2 节点上去查看 Pod 里面启动的 `resource-demo1` 这个容器。

![image-20231030173944436](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231030173944436-1698658791485-1.png)

实际上我们就可以看到这个容器的一些资源情况，Pod 上的资源配置最终也还是通过底层的容器运行时去控制 CGroup 来实现的，进入如下目录查看 CGroup 的配置，该目录就是 CGroup 父级目录，而 CGroup 是通过文件系统来进行资源限制的，所以上面限制容器的资源就可以在该目录下面反映出来：

![image-20231030174518420](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231030174518420.png)

其中 `cpu.cfs_quota_us` 就是 CPU 的限制值，如果要查看具体的容器的资源，也可以进入到容器目录下面去查看即可。

了解下内存这块的资源控制，内存的单位换算比较简单：

`1 MiB = 1024 KiB`，内存这块在 Kubernetes 里一般用的是`Mi`单位，当然你也可以使用`Ki、Gi`甚至`Pi`，看具体的业务需求和资源容量。

单位换算: 这里注意的是`MiB ≠ MB`，MB 是十进制单位，MiB 是二进制，平时以为 MB 等于 1024KB，其实`1MB=1000KB`，`1MiB`才等于`1024KiB`。中间带字母 i 的是国际电工协会（IEC）定的，走1024乘积；KB、MB、GB 是国际单位制，走1000乘积。

这里要注意的是，内存是不可压缩性资源，如果容器使用内存资源到达了上限，那么会`OOM`，造成内存溢出，容器就会终止和退出。可以通过上面的方式去通过查看 CGroup 文件的值来验证资源限制。

