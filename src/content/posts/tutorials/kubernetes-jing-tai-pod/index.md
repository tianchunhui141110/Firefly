---
title: "Kubernetes-静态Pod"
published: 2026-01-05
description: "在 Kubernetes 集群中除了经常使用到的普通的 Pod 外，还有一种特殊的 Pod，叫做Static Pod，也就是静态Pod，静态Pod有什么特殊的地方呢？"
tags: ["Kubernetes"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

在 Kubernetes 集群中除了经常使用到的普通的 Pod 外，还有一种特殊的 Pod，叫做Static Pod，也就是静态Pod，静态Pod有什么特殊的地方呢？

静态 Pod 直接由节点上的 kubelet 进程来管理，不通过 master 节点上的 apiserver。无法与常用的控制器 Deployment 或者 DaemonSet 进行关联，它由 kubelet 进程自己来监控，当 pod 崩溃时会重启该pod，kubelet 也无法对他们进行健康检查。静态 pod 始终绑定在某一个 kubelet 上，并且始终运行在同一个节点上。kubelet会自动为每一个静态 pod 在 Kubernetes 的 apiserver 上创建一个镜像 Pod，因此可以在 apiserver 中查询到该pod，但是不能通过 apiserver 进行控制（例如不能删除）。

创建静态 Pod 有两种方式：`配置文件`和 `HTTP` 两种方式

**配置文件**

配置文件就是放在特定目录下的标准的 JSON 或 YAML 格式的 pod 定义文件。用 `kubelet --pod-manifest-path=<the directory>`来启动 kubelet 进程，kubelet 定期的去扫描这个目录，根据这个目录下出现或消失的 YAML/JSON 文件来创建或删除静态 pod。

比如在 node1 这个节点上用静态 pod 的方式来启动一个 nginx 的服务，配置文件路径为：

```sh
cat /var/lib/kubelet/config.yaml
```

![image-20231030180348902](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231030180348902.png)

打开这个文件可以看到其中有一个属性为 `staticPodPath` 的配置，其实和命令行的 `--pod-manifest-path` 配置是一致的，所以如果通过 kubeadm 的方式来安装的集群环境，对应的 kubelet 已经配置了静态 Pod 文件的路径，默认地址为 `/etc/kubernetes/manifests`，所以只需要在该目录下面创建一个标准的 Pod 的 JSON 或者 YAML 文件即可，如果kubelet 启动参数中没有配置上面的`--pod-manifest-path` 参数的话，那么添加上这个参数然后重启 kubelet 即可。

```sh
cat <<EOF >/etc/kubernetes/manifests/static-web.yaml
apiVersion: v1
kind: Pod
metadata:
  name: static-web
  labels:
    app: static
spec:
  containers:
    - name: web
      image: nginx
      ports:
        - name: web
          containerPort: 80
EOF
```

**通过 HTTP 创建静态 Pods**

kubelet 周期地从 `–manifest-url=` 参数指定的地址下载文件，并且把它翻译成 JSON/YAML 格式的 pod 定义。此后的操作方式与`–pod-manifest-path=` 相同，kubelet 会不时地重新下载该文件，当文件变化时对应地终止或启动静态 pod。

kubelet 启动时，由 `--pod-manifest-path=` 或 `--manifest-url=` 参数指定的目录下定义的所有 pod 都会自动创建，例如，示例中的 `static-web`。

![image-20231030181002778](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231030181002778.png)

![image-20231030181118103](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231030181118103.png)

可以看到这里创建了一个新的镜像 Pod：

```shell
kubectl get pods
```

静态 pod 的标签会传递给镜像 Pod，可以用来过滤或筛选。 需要注意的是，不能通过 API 服务器来删除静态 pod（例如，通过kubectl命令），kubelet 不会删除它。

```shell
kubectl delete pod static-web-node1 -n default
```

![image-20231030181417585](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231030181417585.png)

**静态 Pod 的动态增加和删除**

运行中的 kubelet 周期扫描配置的目录（这个例子中就是 `/etc/kubernetes/manifests`）下文件的变化，当这个目录中有文件出现或消失时创建或删除 pods：

```sh
mv /etc/kubernetes/manifests/static-web.yaml /tmp
```

```sh
crictl ps
```

```sh
mv /tmp/static-web.yaml  /etc/kubernetes/manifests
```

```sh
crictl ps
```

![image-20231030181724270](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231030181724270.png)

用 kubeadm 安装的集群，master 节点上面的几个重要组件都是用静态 Pod 的方式运行的，登录到 master 节点上查看`/etc/kubernetes/manifests`目录：

```shell
ls /etc/kubernetes/manifests
etcd.yaml  kube-apiserver.yaml  kube-controller-manager.yaml  kube-scheduler.yaml
```

现在明白了吧，这种方式将集群的一些组件容器化提供了可能，因为这些 Pod 都不会受到 apiserver 的控制，不然这里kube-apiserver怎么自己去控制自己呢？万一不小心把这个 Pod 删掉了呢？所以只能有kubelet自己来进行控制，这就是静态 Pod。

