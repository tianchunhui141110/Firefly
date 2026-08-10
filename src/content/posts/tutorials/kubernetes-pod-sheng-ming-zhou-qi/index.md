---
title: "Kubernetes-Pod生命周期"
published: 2023-10-30
description: "上图展示了一个 Pod 的完整生命周期过程，其中包含 Init Container、Pod Hook、健康检查 三个主要部分，接下来分别介绍影响 Pod 生命周期的部分："
tags: ["Kubernetes"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

![pod loap](https://blog.tianch.com.cn/img/1662384295453.jpg)

上图展示了一个 Pod 的完整生命周期过程，其中包含 `Init Container`、`Pod Hook`、`健康检查` 三个主要部分，接下来分别介绍影响 Pod 生命周期的部分：

首先在介绍 Pod 的生命周期之前，需要先了解下 Pod 的状态，因为 Pod 状态可以反应出当前我们的 Pod 的具体状态信息，也是分析排错的一个必备的方式。

## 容器状态

Kubernetes 会跟踪 Pod 中每个容器的状态，就像它跟踪 Pod 总体上的[阶段](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/pod-lifecycle/#pod-phase)一样。 你可以使用[容器生命周期回调](https://kubernetes.io/zh-cn/docs/concepts/containers/container-lifecycle-hooks/) 来在容器生命周期中的特定时间点触发事件。

一旦[调度器](https://kubernetes.io/zh-cn/docs/reference/command-line-tools-reference/kube-scheduler/)将 Pod 分派给某个节点，`kubelet` 就通过[容器运行时](https://kubernetes.io/zh-cn/docs/setup/production-environment/container-runtimes)开始为 Pod 创建容器。容器的状态有三种：`Waiting`（等待）、`Running`（运行中）和 `Terminated`（已终止）。

要检查 Pod 中容器的状态，你可以使用 `kubectl describe pod <pod 名称>`。 其输出中包含 Pod 中每个容器的状态。

每种状态都有特定的含义：

### `Waiting` （等待）

如果容器并不处在 `Running` 或 `Terminated` 状态之一，它就处在 `Waiting` 状态。 处于 `Waiting` 状态的容器仍在运行它完成启动所需要的操作：例如， 从某个容器镜像仓库拉取容器镜像，或者向容器应用 [Secret](https://kubernetes.io/zh-cn/docs/concepts/configuration/secret/) 数据等等。 当你使用 `kubectl` 来查询包含 `Waiting` 状态的容器的 Pod 时，你也会看到一个 Reason 字段，其中给出了容器处于等待状态的原因。

### `Running`（运行中）

`Running` 状态表明容器正在执行状态并且没有问题发生。 如果配置了 `postStart` 回调，那么该回调已经执行且已完成。 如果你使用 `kubectl` 来查询包含 `Running` 状态的容器的 Pod 时， 你也会看到关于容器进入 `Running` 状态的信息。

### `Terminated`（已终止）

处于 `Terminated` 状态的容器已经开始执行并且或者正常结束或者因为某些原因失败。 如果你使用 `kubectl` 来查询包含 `Terminated` 状态的容器的 Pod 时， 你会看到容器进入此状态的原因、退出代码以及容器执行期间的起止时间。

如果容器配置了 `preStop` 回调，则该回调会在容器进入 `Terminated` 状态之前执行。

从 Kubernetes 1.27 开始，除了[静态 Pod](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/static-pod/) 和没有 Finalizer 的[强制终止 Pod](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination-forced) 之外，`kubelet` 会将已删除的 Pod 转换到终止阶段 （`Failed` 或 `Succeeded` 具体取决于 Pod 容器的退出状态），然后再从 API 服务器中删除。

如果某节点死掉或者与集群中其他节点失联，Kubernetes 会实施一种策略，将失去的节点上运行的所有 Pod 的 `phase` 设置为 `Failed`。

## Pod状况

Pod 有一个 PodStatus 对象，其中包含一个 [PodConditions](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#podcondition-v1-core) 数组。Pod 可能通过也可能未通过其中的一些状况测试。 Kubelet 管理以下 PodCondition：

- `PodScheduled`：Pod 已经被调度到某节点；
- `PodReadyToStartContainers`：Pod 沙箱被成功创建并且配置了网络（Alpha 特性，必须被[显式启用](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/pod-lifecycle/#pod-has-network)）；
- `ContainersReady`：Pod 中所有容器都已就绪；
- `Initialized`：所有的 [Init 容器](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/init-containers/)都已成功完成；
- `Ready`：Pod 可以为请求提供服务，并且应该被添加到对应服务的负载均衡池中。

| 字段名称             | 描述                                                                 |
| :------------------- | :------------------------------------------------------------------- |
| `type`               | Pod 状况的名称                                                       |
| `status`             | 表明该状况是否适用，可能的取值有 "`True`"、"`False`" 或 "`Unknown`"  |
| `lastProbeTime`      | 上次探测 Pod 状况时的时间戳                                          |
| `lastTransitionTime` | Pod 上次从一种状态转换到另一种状态时的时间戳                         |
| `reason`             | 机器可读的、驼峰编码（UpperCamelCase）的文字，表述上次状况变化的原因 |
| `message`            | 人类可读的消息，给出上次状态转换的详细信息                           |

- type：Condition 类型，包括以下方面：
  - PodScheduled（Pod 已经被调度到其他 node 里）
  - Ready（Pod 能够提供服务请求，可以被添加到所有可匹配服务的负载平衡池中）
  - Initialized（所有的`init containers`已经启动成功）
  - Unschedulable（调度程序现在无法调度 Pod，例如由于缺乏资源或其他限制）
  - ContainersReady（Pod 里的所有容器都是 ready 状态）

```sh
kubectl explain pod.status.phase
```

![image-20231020110315279](https://blog.tianch.com.cn/img/image-20231020110315279.png)

## 重启策略

Pod 的 `spec` 中包含一个 `restartPolicy` 字段，其可能取值包括 Always、OnFailure 和 Never。默认值是 Always。`restartPolicy` 指通过 kubelet 在同一节点上重新启动容器。通过 kubelet 重新启动的退出容器将以指数增加延迟（10s，20s，40s…）重新启动，上限为 5 分钟，并在成功执行 10 分钟后重置。不同类型的的控制器可以控制 Pod 的重启策略：

- `Job`：适用于一次性任务如批量计算，任务结束后 Pod 会被此类控制器清除。Job 的重启策略只能是`"OnFailure"`或者`"Never"`。
- `ReplicaSet`、`Deployment`：此类控制器希望 Pod 一直运行下去，它们的重启策略只能是`"Always"`。
- `DaemonSet`：每个节点上启动一个 Pod，很明显此类控制器的重启策略也应该是`"Always"`。

## 初始化容器

Pod 中最先启动的 `Init Container`，也就是常说的**初始化容器**。`Init Container`就是用来做初始化工作的容器，可以是一个或者多个，如果有多个的话，这些容器会按定义的顺序依次执行。一个 Pod 里面的所有容器是共享数据卷和 `Network Namespace` 的，所以 `Init Container` 里面产生的数据可以被主容器使用到。从上面的 Pod 生命周期的图中可以看出初始化容器是独立与主容器之外的，只有所有的`初始化容器执行完之后，主容器才会被启动。初始化容器的应用场景：

- 等待其他模块 Ready：这个可以用来解决服务之间的依赖问题，比如有一个 Web 服务，该服务又依赖于另外一个数据库服务，但是在启动这个 Web 服务的时候我们并不能保证依赖的这个数据库服务就已经启动起来了，所以可能会出现一段时间内 Web 服务连接数据库异常。要解决这个问题的话我们就可以在 Web 服务的 Pod 中使用一个 `InitContainer`，在这个初始化容器中去检查数据库是否已经准备好了，准备好了过后初始化容器就结束退出，然后我们主容器的 Web 服务才被启动起来，这个时候去连接数据库就不会有问题了。
- 做初始化配置：比如集群里检测所有已经存在的成员节点，为主容器准备好集群的配置信息，这样主容器起来后就能用这个配置信息加入集群。
- 其它场景：如将 Pod 注册到一个中央数据库、配置中心等。

比如实现一个功能，在 Nginx Pod 启动之前去重新初始化首页内容，如下所示的资源清单：（init-pod.yaml）

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: init-demo
spec:
  volumes:
    - name: workdir
      emptyDir: {}
  initContainers:
    - name: install
      image: busybox
      command:
        - wget
        - "-O"
        - "/work-dir/index.html"
        - http://www.baidu.com # https
      volumeMounts:
        - name: workdir
          mountPath: "/work-dir"
  containers:
    - name: web
      image: nginx
      ports:
        - containerPort: 80
      volumeMounts:
        - name: workdir
          mountPath: /usr/share/nginx/html
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
```

上面的资源清单中首先在 Pod 顶层声明了一个名为 workdir 的 `Volume`，前面我们用了 hostPath 的模式，这里我们使用的是 `emptyDir{}`，这个是一个临时的目录，数据会保存在 kubelet 的工作目录下面，生命周期等同于 Pod 的生命周期。

然后定义了一个初始化容器，该容器会下载一个 html 文件到 `/work-dir` 目录下面，但是由于又将该目录声明挂载到了全局的 Volume，同样的主容器 nginx 也将目录 `/usr/share/nginx/html` 声明挂载到了全局的 Volume，所以在主容器的该目录下面会同步初始化容器中创建的 `index.html` 文件。

直接创建上面的 Pod：

```sh
kubectl apply -f init-pod.yaml
```

可以查看 Pod 的详细信息：

```sh
kubectl describe pod init-demo -n default
```

```text
[root@master ~]# kubectl describe pod init-demo -n default

Name:         init-demo
Namespace:    default
Priority:     0
Node:         node3/10.168.1.23
Start Time:   Fri, 20 Oct 2023 14:31:54 +0800
Labels:       <none>
Annotations:  cni.projectcalico.org/containerID: 8991143f9d34292f8f406f9f03db7843d8cc4835f6ee6ba935985c66fc81f79e
              cni.projectcalico.org/podIP: 10.233.92.55/32
              cni.projectcalico.org/podIPs: 10.233.92.55/32
Status:       Running
IP:           10.233.92.55
IPs:
  IP:  10.233.92.55
Init Containers:
  install:
    Container ID:  containerd://172ef7435b04804374ee827fff1b0185e9502434ac84f3e92e5ae0132b2fce1c
    Image:         busybox
    Image ID:      docker.io/library/busybox@sha256:3fbc632167424a6d997e74f52b878d7cc478225cffac6bc977eedfe51c7f4e79
    Port:          <none>
    Host Port:     <none>
    Command:
      wget
      -O
      /work-dir/index.html
      http://www.baidu.com
    State:          Terminated
      Reason:       Completed
      Exit Code:    0
      Started:      Fri, 20 Oct 2023 14:32:01 +0800
      Finished:     Fri, 20 Oct 2023 14:32:01 +0800
    Ready:          True
    Restart Count:  0
    Environment:    <none>
    Mounts:
      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-2td7n (ro)
      /work-dir from workdir (rw)
Containers:
  web:
    Container ID:   containerd://5eadf1c2e3087ff66a039046d0c15757a4ea6dcfacb00a67e40135d30c2daa4d
    Image:          nginx
    Image ID:       docker.io/library/nginx@sha256:b4af4f8b6470febf45dc10f564551af682a802eda1743055a7dfc8332dffa595
    Port:           80/TCP
    Host Port:      0/TCP
    State:          Running
      Started:      Fri, 20 Oct 2023 14:32:05 +0800
    Ready:          True
    Restart Count:  0
    Limits:
      cpu:     500m
      memory:  128Mi
    Requests:
      cpu:        500m
      memory:     128Mi
    Environment:  <none>
    Mounts:
      /usr/share/nginx/html from workdir (rw)
      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-2td7n (ro)
Conditions:
  Type              Status
  Initialized       True
  Ready             True
  ContainersReady   True
  PodScheduled      True
Volumes:
  workdir:
    Type:       EmptyDir (a temporary directory that shares a pod's lifetime)
    Medium:
    SizeLimit:  <unset>
  kube-api-access-2td7n:
    Type:                    Projected (a volume that contains injected data from multiple sources)
    TokenExpirationSeconds:  3607
    ConfigMapName:           kube-root-ca.crt
    ConfigMapOptional:       <nil>
    DownwardAPI:             true
QoS Class:                   Burstable
Node-Selectors:              <none>
Tolerations:                 node.kubernetes.io/not-ready:NoExecute op=Exists for 300s
                             node.kubernetes.io/unreachable:NoExecute op=Exists for 300s
Events:
  Type    Reason     Age    From               Message
  ----    ------     ----   ----               -------
  Normal  Scheduled  5m27s  default-scheduler  Successfully assigned default/init-demo to node3
  Normal  Pulling    5m26s  kubelet            Pulling image "busybox"
  Normal  Pulled     5m20s  kubelet            Successfully pulled image "busybox" in 6.11876556s
  Normal  Created    5m20s  kubelet            Created container install
  Normal  Started    5m20s  kubelet            Started container install
  Normal  Pulling    5m19s  kubelet            Pulling image "nginx"
  Normal  Pulled     5m17s  kubelet            Successfully pulled image "nginx" in 1.85788456s
  Normal  Created    5m17s  kubelet            Created container web
  Normal  Started    5m16s  kubelet            Started container web
```

从上面的描述信息里面可以看到初始化容器已经启动了，现在处于 `Running` 状态，等到初始化容器执行完成后退出初始化容器会变成 `Completed` 状态，然后才会启动主容器。待到主容器也启动完成后，Pod 就会变成`Running` 状态，然后我们去访问下 Pod 主页，验证下是否有我们初始化容器中下载的页面信息：

```sh
kubectl get pods -n default -o wide
```

![image-20231020144101231](https://blog.tianch.com.cn/img/image-20231020144101231.png)

## Pod Hook

Pod 是 Kubernetes 集群中的最小单元，而 Pod 是由容器组成的，所以在讨论 Pod 的生命周期的时候可以先来讨论下容器的生命周期。实际上 Kubernetes 为我们的容器提供了生命周期的钩子`Pod Hook`，Pod Hook 是由 kubelet 发起的，当容器中的进程启动前或者容器中的进程终止之前运行，这是包含在容器的生命周期之中。可以同时为 Pod 中的所有容器都配置 hook。

Kubernetes提供了两种钩子函数：

- `PostStart`：这个钩子在容器创建后立即执行。但是并不能保证钩子将在容器 `ENTRYPOINT` 之前运行，因为没有参数传递给处理程序。主要用于资源部署、环境准备等。不过需要注意的是如果钩子花费太长时间以至于不能运行或者挂起，容器将不能达到 running 状态。
- `PreStop`：这个钩子在容器终止之前立即被调用。它是阻塞的，意味着它是同步的，所以它必须在删除容器的调用发出之前完成。主要用于优雅关闭应用程序、通知其他系统等。如果钩子在执行期间挂起，Pod阶段将停留在 running状态并且永不会达到 failed 状态。

如果 `PostStart` 或者 `PreStop` 钩子失败， 它会杀死容器。所以应该让钩子函数尽可能的轻量。当然有些情况下，长时间运行命令是合理的， 比如在停止容器之前预先保存状态。

另外有两种方式来实现上面的钩子函数：

- `Exec` - 用于执行一段特定的命令，不过要注意的是该命令消耗的资源会被计入容器。
- `HTTP` - 对容器上的特定的端点执行 HTTP 请求。

以下示例中，定义了一个 Nginx Pod，其中设置了 PostStart 钩子函数，即在容器创建成功后，写入一句话到 `/usr/share/message` 文件中：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hook-demo1
spec:
  containers:
    - name: hook-demo1
      image: nginx
      lifecycle:
        postStart:
          exec:
            command:
              - /bin/sh
              - -c
              - echo Hello from the postStart handler > /usr/share/message
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
```

创建上面的 Pod

```sh
kubectl apply -f pod-poststart.yaml
```

创建成功后可以查看容器中 `/usr/share/message` 文件是否内容正确

```sh
kubectl exec -it hook-demo1 -- cat /usr/share/message
```

![image-20231020145249253](https://blog.tianch.com.cn/img/image-20231020145249253.png)

当用户请求删除含有 Pod 的资源对象时（如 Deployment 等），K8S 为了让应用程序优雅关闭（即让应用程序完成正在处理的请求后，再关闭软件），K8S 提供两种信息通知：

- 默认：K8S 通知 node 执行容器 `stop` 命令，容器运行时会先向容器中 PID 为 1 的进程发送系统信号 `SIGTERM`，然后等待容器中的应用程序终止执行，如果等待时间达到设定的超时时间，或者默认超时时间（30s），会继续发送 `SIGKILL` 的系统信号强行 kill 掉进程
- 使用 Pod 生命周期（利用 `PreStop` 回调函数），它在发送终止信号之前执行

默认所有的优雅退出时间都在 30 秒内，`kubectl delete` 命令支持 `--grace-period=<seconds>` 选项，这个选项允许用户用他们自己指定的值覆盖默认值，值`0`代表强制删除 pod。 在 kubectl 1.5 及以上的版本里，执行强制删除时必须同时指定 `--force --grace-period=0`。

强制删除一个 pod 是从集群中还有 etcd 里立刻删除这个 pod，只是当 Pod 被强制删除时， APIServer 不会等待来自 Pod 所在节点上的 kubelet 的确认信息：pod 已经被终止。在 API 里 pod 会被立刻删除，在节点上， pods 被设置成立刻终止后，在强行杀掉前还会有一个很小的宽限期。

以下示例中，定义了一个 Nginx Pod，其中设置了 `PreStop` 钩子函数，即在容器退出之前，优雅的关闭 Nginx：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hook-demo2
spec:
  containers:
    - name: hook-demo2
      image: nginx
      lifecycle:
        preStop:
          exec:
            command:
              - /usr/sbin/nginx
              - -s
              - quit
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"

---
apiVersion: v1
kind: Pod
metadata:
  name: hook-demo3
spec:
  volumes:
    - name: message
      hostPath:
        path: /tmp
  containers:
    - name: hook-demo3
      image: nginx
      ports:
        - containerPort: 80
      volumeMounts:
        - name: message
          mountPath: /usr/share
      lifecycle:
        preStop:
          exec:
            command:
              - /bin/sh
              - -c
              - echo Hello from the preStop Handler > /usr/share/message
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
```

上面定义的两个 Pod，一个是利用 `preStop` 来进行优雅删除，另外一个是利用 `preStop` 来做一些信息记录的事情，直接创建上面的 Pod：

```sh
kubectl apply -f pod-prestop.yaml
```

创建完成后，直接删除 hook-demo2 这个 Pod，在容器删除之前会执行 preStop 里面的优雅关闭命令，这个用法在后面的滚动更新的时候用来保证应用零宕机非常有用。第二个 Pod 声明了一个 hostPath 类型的 Volume，在容器里面声明挂载到了这个 Volume，所以当删除 Pod，退出容器之前，在容器里面输出的信息也会同样的保存到宿主机（一定要是 Pod 被调度到的目标节点）的 `/tmp` 目录下面，可以查看 hook-demo3 这个 Pod 被调度的节点：

```sh
kubectl describe pod hook-demo3 -n default
```

![image-20231030160508981](https://blog.tianch.com.cn/img/image-20231030160508981.png)

删除 hook-demo3 这个 Pod，按照设定在容器退出之前会执行 `preStop` 里面的命令，也就是会往 message 文件中输出一些信息：

```sh
kubectl delete pod hook-demo3 -n default
```

![image-20231030161150163](https://blog.tianch.com.cn/img/image-20231030161150163.png)

另外 Hook 调用的日志没有暴露给 Pod，所以只能通过 describe 命令来获取，如果有错误将可以看到 `FailedPostStartHook` 或 `FailedPreStopHook` 这样的 event。

## Pod健康检查

在 Kubernetes 集群当中，可以通过配置`liveness probe（存活探针`）和 `readiness probe（可读性探针）` 来影响容器的生命周期：

- kubelet 通过使用 `liveness probe` 来确定应用程序是否正在运行，通俗点将就是**是否还活着**。一般来说，如果程序一旦崩溃了， Kubernetes 就会立刻知道这个程序已经终止了，然后就会重启这个程序。而 `liveness probe` 的目的就是来捕获到当前应用程序还没有终止，还没有崩溃，如果出现了这些情况，那么就重启处于该状态下的容器，使应用程序在存在 bug 的情况下依然能够继续运行下去。
- kubelet 使用 `readiness probe` 来确定容器是否已经就绪可以接收流量过来了。这个探针通俗点讲就是说**是否准备好了**，现在可以开始工作了。只有当 Pod 中的容器都处于就绪状态的时候 kubelet 才会认定该 Pod 处于就绪状态，因为一个 Pod 下面可能会有多个容器。当然 Pod 如果处于非就绪状态，那么我们就会将他从 Service 的 Endpoints 列表中移除出来，这样流量就不会被路由到这个 Pod 里面来了。

和前面的钩子函数一样的，这两个探针的支持下面几种配置方式：

- `exec`：执行一段命令
- `http`：检测某个 http 请求
- `tcpSocket`：使用此配置，kubelet 将尝试在指定端口上打开容器的套接字。如果可以建立连接，容器被认为是健康的，如果不能就认为是失败的。实际上就是检查端口。

首先用 exec 执行命令的方式来检测容器的存活，如下：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: liveness-exec
spec:
  containers:
    - name: liveness
      image: busybox
      args:
        - /bin/sh
        - -c
        - touch /tmp/healthy; sleep 30; rm -rf /tmp/healthy; sleep 600
      livenessProbe:
        exec:
          command:
            - cat
            - /tmp/healthy
        initialDelaySeconds: 5
        periodSeconds: 5
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
```

- `periodSeconds`：表示让 kubelet 每隔 5 秒执行一次存活探针，也就是每 5 秒执行一次上面的 `cat /tmp/healthy` 命令，如果命令执行成功了，将返回 0，那么 kubelet 就会认为当前这个容器是存活的，如果返回的是非 0 值，那么 kubelet 就会把该容器杀掉然后重启它。默认是 10 秒，最小 1 秒。
- `initialDelaySeconds`：表示在第一次执行探针的时候要等待 5 秒，这样能够确保容器能够有足够的时间启动起来。如果第一次执行探针等候的时间太短，很有可能容器还没正常启动起来，所以存活探针很可能始终都是失败的，这样就会无休止的重启下去。

容器启动的时候，执行了如下命令：

```shell
/bin/sh -c "touch /tmp/healthy; sleep 120; rm -rf /tmp/healthy; sleep 600"
```

在容器最开始的 30 秒内创建了一个 `/tmp/healthy` 文件，在这 30 秒内执行 `cat /tmp/healthy` 命令都会返回一个成功的返回码。30 秒后，删除这个文件，现在执行 `cat /tmp/healthy` 就会失败了（默认检测失败 3 次会认为失败），所以这个时候就会重启容器了。

创建该 Pod，然后在 30 秒内，查看 Pod 的 Event：

```sh
kubectl apply -f liveness-exec.yaml
```

```sh
kubectl describe pod liveness-exec -n default
```

![image-20231030163801253](https://blog.tianch.com.cn/img/image-20231030163801253.png)

![image-20231030163824473](https://blog.tianch.com.cn/img/image-20231030163824473.png)

![image-20231030164005984](https://blog.tianch.com.cn/img/image-20231030164005984.png)

还可以使用`HTTP GET`请求来配置我们的存活探针，我们这里使用一个 liveness 镜像来验证演示下：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: liveness-http
spec:
  containers:
    - name: liveness
      image: cnych/liveness
      args:
        - /server
      livenessProbe:
        httpGet:
          path: /healthz
          port: 8080
          httpHeaders:
            - name: X-Custom-Header
              value: Awesome
        initialDelaySeconds: 3
        periodSeconds: 3
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
```

根据 `periodSeconds` 属性可以知道 kubelet 需要每隔 3 秒执行一次 `liveness Probe`，该探针将向容器中的 server 的 8080 端口发送一个 HTTP GET 请求。如果 server 的 `/healthz` 路径的 handler 返回一个成功的返回码，kubelet 就会认定该容器是活着的并且很健康，如果返回失败的返回码，kubelet 将杀掉该容器并重启它。initialDelaySeconds 指定 kubelet 在该执行第一次探测之前需要等待 3 秒钟。

返回码:通常来说，任何大于`200`小于`400`的状态码都会认定是成功的返回码。其他返回码都会被认为是失败的返回码。

healthz 的实现：

```go
http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
    duration := time.Now().Sub(started)
    if duration.Seconds() > 10 {
        w.WriteHeader(500)
        w.Write([]byte(fmt.Sprintf("error: %v", duration.Seconds())))
    } else {
        w.WriteHeader(200)
        w.Write([]byte("ok"))
    }
})
```

大概意思就是最开始前 10s 返回状态码 200，10s 过后就返回状态码 500。所以当容器启动 3 秒后，kubelet 开始执行健康检查。第一次健康检查会成功，因为是在 10s 之内，但是 10 秒后，健康检查将失败，因为现在返回的是一个错误的状态码了，所以 kubelet 将会杀掉和重启容器。

创建下该 Pod 测试下效果，10 秒后，查看 Pod 的 event，确认 liveness probe 失败并重启了容器：

```sh
kubectl apply -f liveness-http.yaml
```

![image-20231030165523842](https://blog.tianch.com.cn/img/image-20231030165523842.png)

除了上面的 `exec` 和 `httpGet` 两种检测方式之外，还可以通过 `tcpSocket` 方式来检测端口是否正常。

另外前面提到了探针里面有一个 `initialDelaySeconds` 的属性，可以来配置第一次执行探针的等待时间，对于启动非常慢的应用这个参数非常有用，比如 `Jenkins`、`Gitlab` 这类应用，但是如何设置一个合适的初始延迟时间呢？这个就和应用具体的环境有关系了，所以这个值往往不是通用的，这样的话可能就会导致一个问题，资源清单在别的环境下可能就会健康检查失败了，为解决这个问题，在 Kubernetes v1.16 版本官方特地新增了一个 `startupProbe（启动探针）`，该探针将推迟所有其他探针，直到 Pod 完成启动为止，使用方法和存活探针一样：

```yaml
startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  failureThreshold: 30 # 尽量设置大点
  periodSeconds: 10
```

比如上面这里的配置表示慢速容器最多可以有 5 分钟（30 个检查 \* 10 秒= 300s）来完成启动。

有的时候，应用程序可能暂时无法对外提供服务，例如，应用程序可能需要在启动期间加载大量数据或配置文件。在这种情况下，不想杀死应用程序，也不想对外提供服务。那么这个时候就可以使用 `readiness probe` 来检测和减轻这些情况，Pod 中的容器可以报告自己还没有准备，不能处理 Kubernetes 服务发送过来的流量。`readiness probe` 的配置跟 `liveness probe` 基本上一致的，唯一的不同是使用 `readinessProbe` 而不是 `livenessProbe`，两者如果同时使用的话就可以确保流量不会到达还未准备好的容器，准备好过后，如果应用程序出现了错误，则会重新启动容器。

另外除了上面的 `initialDelaySeconds` 和 `periodSeconds` 属性外，探针还可以配置如下几个参数：

- `timeoutSeconds`：探测超时时间，默认 1 秒，最小 1 秒。
- `successThreshold`：探测失败后，最少连续探测成功多少次才被认定为成功，默认是 1，但是如果是 `liveness` 则必须是 1。最小值是 1。
- `failureThreshold`：探测成功后，最少连续探测失败多少次才被认定为失败，默认是 3，最小值是 1。

