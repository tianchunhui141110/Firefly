---
title: "Kubernetes-NFS"
published: 2026-01-05
description: "nfs 的默认配置文件在 /etc/exports 文件下，在该文件中添加下面的配置信息"
tags: ["Kubernetes"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

# 安装

### 安装nfs

```sh
yum -y install nfs-utils rpcbind
```

### 配置共享目录

```sh
mkdir -p /opt/nfs
chmod 755 /opt/nfs
```

### 配置nfs

nfs 的默认配置文件在 `/etc/exports` 文件下，在该文件中添加下面的配置信息

```sh
vim /etc/exports
/opt/nfs  10.168.1.0/24(rw,sync,no_root_squash)
```

配置说明：

- `/opt/nfs`：是共享的数据目录
- \*：表示任何人都有权限连接，当然也可以是一个网段，一个 IP，也可以是域名 这里写10.168.1.0/24 我的内网网段
- rw：读写的权限
- sync：表示文件同时写入硬盘和内存
- no_root_squash：当登录 NFS 主机使用共享目录的使用者是 root 时，其权限将被转换成为匿名使用者，通常它的 UID 与 GID，都会变成 nobody 身份

### 启动服务

nfs 需要向 rpc 注册，rpc 一旦重启了，注册的文件都会丢失，向他注册的服务都需要重启 注意启动顺序，先启动 rpcbind

#### 启动rpcbind服务

```sh
systemctl start rpcbind.service
systemctl enable rpcbind
systemctl status rpcbind
```

![image-20231013164935829](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231212193238.png)

看到上面的 active 证明启动成功了

#### 启动nfs服务

```sh
systemctl start nfs.service
systemctl enable nfs
systemctl status nfs
```

![image-20231013165243369](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231212193235.png)

看到上面的 active 证明启动成功了

还可以通过下面的命令确认下：

```shell
rpcinfo -p|grep nfs
```

![image-20231212193352295](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231212193354.png)

### 查看目录挂载权限

```sh
cat /var/lib/nfs/etab
```

![image-20231013165418547](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231212193230.png)

### 安装nfs客户端

到这里就把 nfs server 给安装成功了，然后就是前往节点安装 nfs 的客户端来验证，安装 nfs 当前也需要先关闭防火墙：

```sh
systemctl stop firewalld.service
systemctl disable firewalld.service
```

### 安装nfs

```sh
yum -y install nfs-utils rpcbind
```

### 启动服务

nfs 需要向 rpc 注册，rpc 一旦重启了，注册的文件都会丢失，向他注册的服务都需要重启 注意启动顺序，先启动 rpcbind

#### 启动rpcbind服务

```sh
systemctl start rpcbind.service
systemctl enable rpcbind
systemctl status rpcbind
```

![image-20231013164935829](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231212193704.png)

看到上面的 active 证明启动成功了

#### 启动nfs服务

```sh
systemctl start nfs.service
systemctl enable nfs
systemctl status nfs
```

![image-20231013165243369](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231212193702.png)

看到上面的 active 证明启动成功了

### 挂载数据目录

```sh
showmount -e 10.168.1.100
```

![image-20231013165832419](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231212193700.png)

### 测试挂载

然后我们在客户端上新建目录：

```shell
mkdir -p /root/course/kubeadm/data
```

将 nfs 共享目录挂载到上面的目录：

```shell
mount -t nfs 10.168.1.100:/opt/nfs /root/course/kubeadm/data
```

挂载成功后，在客户端上面的目录中新建一个文件，然后我们观察下 nfs 服务端的共享目录下面是否也会出现该文件：

```shell
touch /root/course/kubeadm/data/test.txt
```

然后在 nfs 服务端查看：

```shell
ll /var/lib/k8s/data/
-rw-r--r-- 1 nfsnobody nfsnobody    0 Dec 12 19:43 test.txt
```

如果上面出现了 test.txt 的文件，那么证明 nfs 挂载成功了。

# 使用

创建一个如下所示 nfs 类型的 PV 资源对象：_nfs-volume.yaml_

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: nfs-pv
spec:
  storageClassName: manual
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  nfs:
    path: /opt/nfs # 指定nfs的挂载点
    server: 10.168.1.100 # 指定nfs服务地址
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: nfs-pvc
spec:
  storageClassName: manual
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

用户真正使用的是 PVC，而要使用 PVC 的前提就是必须要先和某个符合条件的 PV 进行一一绑定，比如存储容器、访问模式，以及 PV 和 PVC 的 storageClassName 字段必须一样，这样才能够进行绑定，当 PVC 和 PV 绑定成功后就可以直接使用这个 PVC 对象了：_nfs-pod.yaml_

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-volumes
spec:
  volumes:
    - name: nfs
      persistentVolumeClaim:
        claimName: nfs-pvc
  containers:
    - name: web
      image: nginx
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
      ports:
        - name: web
          containerPort: 80
      volumeMounts:
        - name: nfs
          subPath: test-volumes
          mountPath: "/usr/share/nginx/html"
```

直接创建上面的资源对象即可：

```sh
kubectl apply -f volume.yaml
```

```sh
kubectl apply -f pod.yaml
```

```sh
kubectl get pv nfs-pv
```

![image-20231212195908587](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231212195910.png)

由于 PV 中的数据为空，所以挂载后会将 nginx 容器中的 `/usr/share/nginx/html` 目录覆盖，那么访问应用的时候就没有内容了：

```sh
curl http://10.233.92.95
```

![image-20231212200025141](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231212200026.png)

在 PV 目录中添加一些内容：

```sh
#在nfs服务器上执行
echo "nfs pv content" > /opt/nfs/test-volumes/index.html
```

然后重新访问就有数据了，而且 Pod 应用挂掉或者被删掉重新启动后数据还是存在的，因为数据已经持久化了。

![image-20231212200331680](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231212200333.png)

上面的示例中需要手动去创建 PV 来和 PVC 进行绑定，有的场景下面需要自动创建 PV，这个时候就需要使用到 StorageClass 了，并且需要一个对应的 provisioner 来自动创建 PV，比如这里使用的 NFS 存储，则可以使用 [nfs-subdir-external-provisioner](https://github.com/kubernetes-sigs/nfs-subdir-external-provisioner) 这个 Provisioner，它使用现有的和已配置的 NFS 服务器来支持通过 PVC 动态配置 PV，持久卷配置为 `${namespace}-${pvcName}-${pvName}`，首先使用 Helm Chart 来安装：

```sh
helm repo add nfs-subdir-external-provisioner https://kubernetes-sigs.github.io/nfs-subdir-external-provisioner/
helm upgrade --install nfs-subdir-external-provisioner nfs-subdir-external-provisioner/nfs-subdir-external-provisioner --set nfs.server=10.168.1.100 --set nfs.path=/opt/nfs -n kube-system
```

上面的命令会在 `kube-system` 命名空间下安装 `nfs-subdir-external-provisioner`，并且会创建一个名为 `nfs-client` 默认的 StorageClass：

![image-20231212200648291](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231212200650.png)

```sh
kubectl get sc nfs-client -o yaml
```

![image-20231212200718716](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231212200722.png)

如果把nfs-client设置成默认的存储类之后,创建 PVC 时如果没有指定具体的 `StorageClass` 的时候，则会使用上面的 SC(nfs-client) 自动创建一个 PV。这里没有把nfs设置成默认的SC,所以要使用nfs-client的SC就需要指定*storageClassName*,比如创建一个如下所示的 PVC：_nfs-sc-pvc.yaml_

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: nfs-sc-pvc
spec:
  storageClassName: nfs-client # 不指定则使用默认的 SC
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

直接创建上面的 PVC 资源对象后就会自动创建一个 PV 与其进行绑定：

```sh
kubectl apply -f nfs-sc-pvc.yaml
```

![image-20231212201424344](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231212201426.png)

对应自动创建的 PV 如下所示：

```sh
kubectl get pv pvc-e662895d-e1e6-4e11-afe1-33f80fee7c6a -o yaml
```

![image-20231212201542622](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231212201544.png)

挂载的 nfs 目录为 `/opt/nfs/default-nfs-sc-pvc-pvc-e662895d-e1e6-4e11-afe1-33f80fee7c6a`，和上面的 `${namespace}-${pvcName}-${pvName}` 规范一致的。

# 原理

只是在 volumes 中指定了上面创建的 PVC 对象，当这个 Pod 被创建之后， kubelet 就会把这个 PVC 对应的这个 NFS 类型的 Volume（PV）挂载到这个 Pod 容器中的目录中去。前面也提到了这样的话对于普通用户来说完全就不用关心后面的具体存储在 NFS 还是 Ceph 或者其他了，只需要直接使用 PVC 就可以了，因为真正的存储是需要很多相关的专业知识的，这样就完全职责分离解耦了。

普通用户直接使用 PVC 没有问题，但是也会出现一个问题，那就是当普通用户创建一个 PVC 对象的时候，这个时候系统里面并没有合适的 PV 来和它进行绑定，因为 PV 大多数情况下是管理员创建的，这个时候启动 Pod 肯定就会失败了，如果现在管理员如果去创建一个对应的 PV 的话，PVC 和 PV 当然就可以绑定了，然后 Pod 也会自动的启动成功，这是因为在 Kubernetes 中有一个专门处理持久化存储的控制器 Volume Controller，这个控制器下面有很多个控制循环，其中一个就是用于 PV 和 PVC 绑定的 `PersistentVolumeController`。

`PersistentVolumeController` 会不断地循环去查看每一个 PVC，是不是已经处于 Bound（已绑定）状态。如果不是，那它就会遍历所有的、可用的 PV，并尝试将其与未绑定的 PVC 进行绑定，这样，Kubernetes 就可以保证用户提交的每一个 PVC，只要有合适的 PV 出现，它就能够很快进入绑定状态。而所谓将一个 PV 与 PVC 进行**绑定**，其实就是将这个 PV 对象的名字，填在了 PVC 对象的 `spec.volumeName` 字段上。

PV 和 PVC 绑定上了，那么又是如何将容器里面的数据进行持久化的呢，Docker 的 Volume 挂载其实就是**将一个宿主机上的目录和一个容器里的目录绑定挂载在了一起**，具有持久化功能当然就是指的宿主机上面的这个目录了，当容器被删除或者在其他节点上重建出来以后，这个目录里面的内容依然存在，所以一般情况下实现持久化是需要一个远程存储的，比如 NFS、Ceph 或者云厂商提供的磁盘等等。所以接下来需要做的就是持久化宿主机目录这个过程。

当 Pod 被调度到一个节点上后，节点上的 kubelet 组件就会为这个 Pod 创建它的 Volume 目录，默认情况下 kubelet 为 Volume 创建的目录在 kubelet 工作目录下面：

```shell
/var/lib/kubelet/pods/<Pod的ID>/volumes/kubernetes.io~<Volume类型>/<Volume名字>
```

比如上面创建的 Pod 对应的 Volume 目录完整路径为：

```shell
/opt/nfs/default-nfs-sc-pvc-pvc-e662895d-e1e6-4e11-afe1-33f80fee7c6a/volumes/kubernetes.io~nfs/nfs-pv
```

!!! info "提示" 要获取 Pod 的唯一标识 uid，可通过命令 `kubectl get pod pod名 -o jsonpath={.metadata.uid}` 获取。

然后就需要根据 Volume 类型来决定需要做什么操作了，假如后端存储使用的 Ceph RBD，那么 kubelet 就需要先将 Ceph 提供的 RBD 挂载到 Pod 所在的宿主机上面，这个阶段在 Kubernetes 中被称为 **Attach 阶段**。Attach 阶段完成后，为了能够使用这个块设备，kubelet 还要进行第二个操作，即：**格式化**这个块设备，然后将它**挂载**到宿主机指定的挂载点上。这个挂载点，也就是上面提到的 Volume 的宿主机的目录。将块设备格式化并挂载到 Volume 宿主机目录的操作，在 Kubernetes 中被称为 **Mount 阶段**。但是对于这里使用的 NFS 就更加简单了， 因为 NFS 存储并没有一个设备需要挂载到宿主机上面，所以这个时候 kubelet 就会直接进入第二个 `Mount` 阶段，相当于直接在宿主机上面执行如下的命令：

```shell
mount -t nfs 10.168.1.100:/opt/nfs /var/lib/kubelet/pods/d4fcdb11-baf7-43d9-8d7d-3ede24118e08/volumes/kubernetes.io~nfs/nfs-pv
```

同样可以在测试的 Pod 所在节点查看 Volume 的挂载信息：

```shell
findmnt /var/lib/kubelet/pods/d4fcdb11-baf7-43d9-8d7d-3ede24118e08/volumes/kubernetes.io~nfs/nfs-pv
TARGET                                                                               SOURCE                 FSTYPE OPTIONS
/var/lib/kubelet/pods/d4fcdb11-baf7-43d9-8d7d-3ede24118e08/volumes/kubernetes.io~nfs/nfs-pv
                                                                                     192.168.31.31:/var/lib/k8s/data/ nfs4   rw,relatime,
```

可以看到这个 Volume 被挂载到了 NFS（10.168.1.100:/opt/nfs/）下面，以后在这个目录里写入的所有文件，都会被保存在远程 NFS 服务器上。

这样在经过了上面的阶段过后，就得到了一个持久化的宿主机上面的 Volume 目录了，接下来 kubelet 只需要把这个 Volume 目录挂载到容器中对应的目录即可，这样就可以为 Pod 里的容器挂载这个持久化的 Volume 了，这一步其实也就相当于执行了如下所示的命令：

```shell
# docker 或者 nerdctl
docker run -v /var/lib/kubelet/pods/<Pod的ID>/volumes/kubernetes.io~<Volume类型>/<Volume名字>:/<容器内的目标目录> 镜像 ...
```

整个存储的架构可以用下图来说明： ![存储架构](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231212202519.png)

- PV Controller：负责 PV/PVC 的绑定，并根据需求进行数据卷的 Provision/Delete 操作
- AD Controller：负责存储设备的 Attach/Detach 操作，将设备挂载到目标节点
- Volume Manager：管理卷的 Mount/Unmount 操作、卷设备的格式化等操作
- Volume Plugin：扩展各种存储类型的卷管理能力，实现第三方存储的各种操作能力和 Kubernetes 存储系统结合

上面使用的 NFS 就属于 `In-Tree` 这种方式，`In-Tree` 就是在 Kubernetes 源码内部实现的，和 Kubernetes 一起发布、管理的，但是更新迭代慢、灵活性比较差，另外一种方式 `Out-Of-Tree` 是独立于 Kubernetes 的，目前主要有 `CSI` 和 `FlexVolume` 两种机制，开发者可以根据自己的存储类型实现不同的存储插件接入到 Kubernetes 中去，其中 `CSI` 是现在也是以后主流的方式。

