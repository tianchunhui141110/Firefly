---
title: "Containerd的安装和使用"
published: 2026-01-05
description: "我的系统是 CentOS 7.9"
tags: ["Containerd"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

![containerd 架构](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20210810134700.png)

## 安装

我的系统是 `CentOS 7.9`

### 安装 `seccomp` 依赖：

缺少依赖或依赖版本过低后面启动容器会报错

![image-20231015233431916](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015233431916.png)

【报错原因】 缺少依赖包libseccomp（2.4以上版本）

【解决办法】 安装libseccomp 2.5.1

```sh
# 查看是否安装libseccomp
rpm -qa |grep libseccomp

# 卸载2.3.1版本
yum remove libseccomp -y

# 安装2.5.1
wget http://rpmfind.net/linux/centos/8-stream/BaseOS/x86_64/os/Packages/libseccomp-2.5.1-1.el8.x86_64.rpm
rpm -ivh libseccomp-2.5.1-1.el8.x86_64.rpm
```

### 安装Containerd

由于 containerd 需要调用 runc，所以需要先安装 runc，不过 containerd 提供了一个包含相关依赖的压缩包 `cri-containerd-cni-${VERSION}.${OS}-${ARCH}.tar.gz`，可以直接使用这个包来进行安装。[release页面](https://github.com/containerd/containerd/releases)

```sh
yum install -y wget

wget https://github.com/containerd/containerd/releases/download/v1.7.7/cri-containerd-cni-1.7.7-linux-amd64.tar.gz
# 如果有限制，也可以替换成下面的 URL 加速下载
# wget https://download.fastgit.org/containerd/containerd/releases/download/v1.7.7/cri-containerd-cni-1.7.7-linux-amd64.tar.gz
```

可以通过 tar 的 `-t` 选项直接看到压缩包中包含哪些文件：

```sh
tar -tf cri-containerd-cni-1.7.7-linux-amd64.tar.gz

cri-containerd.DEPRECATED.txt
etc/
etc/cni/
etc/cni/net.d/
etc/cni/net.d/10-containerd-net.conflist
etc/crictl.yaml
etc/systemd/
etc/systemd/system/
etc/systemd/system/containerd.service
usr/
usr/local/
usr/local/sbin/
usr/local/sbin/runc
usr/local/bin/
usr/local/bin/ctd-decoder
usr/local/bin/critest
usr/local/bin/containerd-shim-runc-v1
usr/local/bin/containerd-stress
usr/local/bin/containerd-shim-runc-v2
usr/local/bin/containerd
usr/local/bin/containerd-shim
usr/local/bin/ctr
usr/local/bin/crictl
opt/
opt/cni/
opt/cni/bin/
opt/cni/bin/host-device
opt/cni/bin/macvlan
opt/cni/bin/host-local
opt/cni/bin/vlan
opt/cni/bin/bandwidth
opt/cni/bin/tuning
opt/cni/bin/dhcp
opt/cni/bin/ptp
opt/cni/bin/portmap
opt/cni/bin/dummy
opt/cni/bin/vrf
opt/cni/bin/loopback
opt/cni/bin/static
opt/cni/bin/ipvlan
opt/cni/bin/firewall
opt/cni/bin/bridge
opt/cni/bin/sbr
opt/containerd/
opt/containerd/cluster/
opt/containerd/cluster/gce/
opt/containerd/cluster/gce/env
opt/containerd/cluster/gce/cloud-init/
opt/containerd/cluster/gce/cloud-init/master.yaml
opt/containerd/cluster/gce/cloud-init/node.yaml
opt/containerd/cluster/gce/cni.template
opt/containerd/cluster/gce/configure.sh
opt/containerd/cluster/version
```

将压缩包解压到系统目录

```sh
tar -C / -xzf cri-containerd-cni-1.7.7-linux-amd64.tar.gz
```

将 `/usr/local/bin` 和 `/usr/local/sbin` 追加到 `~/.bashrc` 文件的 `PATH` 环境变量中

```sh
vim ~/.bashrc

# 将下面这行代码追加到文件最后一行
export PATH=$PATH:/usr/local/bin:/usr/local/sbin
```

立即生效

```sh
source ~/.bashrc
```

containerd 的默认配置文件为 `/etc/containerd/config.toml`，通过命令生成一个默认的配置

```sh
mkdir -p /etc/containerd
containerd config default > /etc/containerd/config.toml
```

- version =2 ：这个是新本版基本默认的选项。
- root：containerd保存元数据的地方。
- state: containerd的状态目录，重启数据就会刷新，就一个临时目录。
- address: 这个指的是containerd监听的套接字。
- plugins: 其中sandbox_image配置的是cni的插件，
- 以及配置的cni的二进制目录和初始化目录；还有配置的私有库的地址，证书，访问的用户密码
- path: container的二进制文件路径
- interval:containerd重启的时间间隔
- runtime：这部分配置需要的运行时runc,containerd-shim这个垫片可以选择用或者不用

下载的 containerd 压缩包中包含一个 `etc/systemd/system/containerd.service` 的文件，这样我们就可以通过 systemd 来配置 containerd 作为守护进程运行了，内容如下

```sh
cat /etc/systemd/system/containerd.service

# Copyright The containerd Authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

[Unit]
Description=containerd container runtime
Documentation=https://containerd.io
After=network.target local-fs.target

[Service]
#uncomment to enable the experimental sbservice (sandboxed) version of containerd/cri integration
#Environment="ENABLE_CRI_SANDBOXES=sandboxed"
ExecStartPre=-/sbin/modprobe overlay
ExecStart=/usr/local/bin/containerd

Type=notify
Delegate=yes
KillMode=process
Restart=always
RestartSec=5
# Having non-zero Limit*s causes performance problems due to accounting overhead
# in the kernel. We recommend using cgroups to do container-local accounting.
LimitNPROC=infinity
LimitCORE=infinity
LimitNOFILE=infinity
# Comment TasksMax if your systemd version does not supports it.
# Only systemd 226 and above support this version.
TasksMax=infinity
OOMScoreAdjust=-999

[Install]
WantedBy=multi-user.target
```

这里有两个重要的参数：

- `Delegate`: 这个选项允许 containerd 以及运行时自己管理自己创建容器的 cgroups。如果不设置这个选项，systemd 就会将进程移到自己的 cgroups 中，从而导致 containerd 无法正确获取容器的资源使用情况。
- `KillMode`: 这个选项用来处理 containerd 进程被杀死的方式。默认情况下，systemd 会在进程的 cgroup 中查找并杀死 containerd 的所有子进程。KillMode 字段可以设置的值如下。
  - `control-group`（默认值）：当前控制组里面的所有子进程，都会被杀掉
  - `process`：只杀主进程
  - `mixed`：主进程将收到 SIGTERM 信号，子进程收到 SIGKILL 信号
  - `none`：没有进程会被杀掉，只是执行服务的 stop 命令

需要将 KillMode 的值设置为 process，这样可以确保升级或重启 containerd 时不杀死现有的容器。

### 启动Containerd 并设置成开机启动

```sh
systemctl enable containerd --now
```

### 查看和验证

启动完成后就可以使用 containerd 的本地 CLI 工具 `ctr` 了，比如查看版本

```she
ctr -v
ctr version
```

![image-20231015223026051](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015223026051.png)

### 配置文件解析

生成的默认配置文件`/etc/containerd/config.toml`

每一个顶级配置块的命名都是 `plugins."io.containerd.xxx.vx.xxx"` 这种形式，每一个顶级配置块都表示一个插件，其中 `io.containerd.xxx.vx` 表示插件的类型，`vx` 后面的 `xxx` 表示插件的 ID，我们可以通过 `ctr` 查看插件列表:

```sh
ctr plugin ls
```

![image-20231015223702053](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015223702053.png)

顶级配置块下面的子配置块表示该插件的各种配置，比如 cri 插件下面就分为 containerd、cni 和 registry 的配置，而 containerd 下面又可以配置各种 runtime，还可以配置默认的 runtime。比如现在我们要为镜像配置一个加速器，那么就需要在 cri 配置块下面的 `registry` 配置块下面进行配置 `registry.mirrors`：

```sh
[plugins."io.containerd.grpc.v1.cri".registry]
  [plugins."io.containerd.grpc.v1.cri".registry.mirrors]
    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."docker.io"]
      endpoint = ["https://akqgo94r.mirror.aliyuncs.com"]
    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."k8s.gcr.io"]
      endpoint = ["https://registry.aliyuncs.com/k8sxio"]
```

- `registry.mirrors."xxx"`: 表示需要配置 mirror 的镜像仓库，例如 `registry.mirrors."docker.io"` 表示配置 docker.io 的 mirror。
- `endpoint`: 表示提供 mirror 的镜像加速服务，比如我们可以注册一个阿里云的镜像服务来作为 docker.io 的 mirror。

另外在默认配置中还有两个关于存储的配置路径：

```sh
root = "/var/lib/containerd"
state = "/run/containerd"
```

其中 `root` 是用来保存持久化数据，包括 Snapshots, Content, Metadata 以及各种插件的数据，每一个插件都有自己单独的目录，Containerd 本身不存储任何数据，它的所有功能都来自于已加载的插件。

而另外的 `state` 是用来保存运行时的临时数据的，包括 sockets、pid、挂载点、运行时状态以及不需要持久化的插件数据。

## Containerd的使用

- ### 帮助

  ```sh
  ctr
  ```

  ![image-20231015224611650](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015224611650.png)

- ### 拉取镜像

  拉取镜像可以使用 `ctr image pull` 来完成，比如拉取 Docker Hub 官方镜像 `nginx:alpine`，需要注意的是镜像地址需要加上 `docker.io` Host 地址

  ```sh
  ctr image pull docker.io/library/nginx:alpine
  ```

  ![image-20231015224830196](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015224830196.png)

- 镜像列表

  `images`可以简写成`image` 或者直接简写成`i`

  `list`可以简写成`ls`

  ```sh
  ctr images list
  ctr image list
  ctr i list

  ctr images ls
  ctr image ls
  ctr i ls
  ```

  ![image-20231015225437782](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015225437782.png)

  使用 `-q（--quiet）` 选项可以只打印镜像名称

  ```sh
  ctr images list -q
  ctr image list -q
  ctr i list -q

  ctr images ls -q
  ctr image ls -q
  ctr i ls -q
  ```

  ![image-20231015225642753](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015225642753.png)

- ### 检测本地镜像

  主要查看其中的 `STATUS`，`complete` 表示镜像是完整可用的状态

  ```sh
  ctr i check
  ```

  ![image-20231015225748148](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015225748148.png)

- ### 重新打Tag

  ```sh
  ctr image tag docker.io/library/nginx:alpine harbor.k8s.local/tianch/nginx:alpine
  ```

  ![image-20231015225953125](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015225953125.png)

  ![image-20231015230027828](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015230027828.png)

- ### 删除镜像

  不需要使用的镜像也可以使用 `ctr image rm` 进行删除

  ```sh
  ctr image rm harbor.k8s.local/tianch/nginx:alpine
  ```

  ![image-20231015230146446](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015230146446.png)

  加上 `--sync` 选项可以同步删除镜像和所有相关的资源

- ### 将镜像挂载到主机目录

  ```sh
  ctr image mount docker.io/library/nginx:alpine /mnt
  tree -L 1 /mnt
  ```

  没有tree命令使用yum安装一下

  ```sh
  yum install -y tree
  ```

  ![image-20231015230356220](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015230356220.png)

- ### 将镜像从主机目录卸载

  ```sh
  ctr image unmount /mnt
  ```

  ![image-20231015230633929](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015230633929.png)

- ### 镜像导出

  ```sh
  ctr image export --all-platforms nginx.tar.gz docker.io/library/nginx:alpine
  ```

  可能会出现类似于 `ctr: content digest sha256:xxxxxx not found` 的错误，解决办法需要 pull 所有平台镜像

  ![image-20231015230924372](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015230924372.png)

  ```sh
  ctr i pull --all-platforms docker.io/library/nginx:alpine
  ```

  再重新执行导出命令

  ![image-20231015231153565](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015231153565.png)

- ### 镜像导入

  ```sh
  ctr i import nginx.tar.gz
  ```

  ![image-20231015231648205](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015231648205.png)

- ### 创建容器

  `containers`可以简写为`container`或者`c`

  ```sh
  ctr c create docker.io/library/nginx:alpine nginx
  ```

- ### 容器列表

  ```sh
  ctr c ls
  ```

  同样可以加上 `-q` 选项精简列表内容

  ![image-20231015232054569](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015232054569.png)

- ### 查看容器详细配置

  类似于 `docker inspect` 功能

  ```sh
  ctr c info nginx
  ```

- ### 删除容器

  `rm`也可换成`remove` `delete` `del`

  ```sh
  ctr c rm nginx
  ```

  ![image-20231015232301141](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015232301141.png)

- ### 启动容器

  `tasks`可以写成`task` 或者`t`

  通过 `container create` 命令创建的容器，并没有处于运行状态，只是一个静态的容器。一个 container 对象只是包含了运行一个容器所需的资源及相关配置数据，表示 namespaces、rootfs 和容器的配置都已经初始化成功了，只是用户进程还没有启动。

  一个容器真正运行起来是由 Task 任务实现的，Task 可以为容器设置网卡，还可以配置工具来对容器进行监控等。

  Task 相关操作可以通过 `ctr task` 获取，如下我们通过 Task 来启动容器

  ```sh
  ctr task start -d nginx
  ```

  ![image-20231015233813044](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015233813044.png)

- ### 进入容器

  ```sh
  ctr task exec -t --exec-id 0 nginx sh
  ```

  ![image-20231015234004576](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015234004576.png)

  必须要指定 `--exec-id` 参数，这个 id 可以随便写，只要唯一就行

- ### 暂停容器

  和 `docker pause` 类似

  ```sh
  ctr task pause nginx
  ```

  ![image-20231015234137929](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015234137929.png)

- ### 恢复容器

  ```sh
  ctr task resume nginx
  ```

  ![image-20231015234228568](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015234228568.png)

  ctr 没有 stop 容器的功能，只能暂停或者kill掉容器

- ### 杀掉容器

  ```sh
  ctr task kill nginx
  ```

  ![image-20231015234414953](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015234414953.png)

- ### 限额与使用量

  ```sh
  ctr task metrics nginx
  ```

  ![image-20231015235005852](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015235005852.png)

  还可以使用 `task ps` 命令查看容器中所有进程在宿主机中的 PID

  ```sh
  ctr t ps nginx
  ```

  ![image-20231015235111771](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015235111771.png)

  其中第一个 PID 就是容器中的 1 号进程

## 命名空间

`namespaces`可以简写成`namespace` `ns` 如果不指定，ctr 默认使用的是 `default` 空间

Docker 其实也是默认调用的 containerd，事实上 Docker 使用的 containerd 下面的命名空间默认是 `moby`，而不是 `default`，所以用 docker 启动容器，可以通过 `ctr -n moby` 来定位下面的容器

```sh
ctr -n moby container ls
```

![image-20231016000255901](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016000255901.png)

同样 Kubernetes 下使用的 containerd 默认命名空间是 `k8s.io`，所以我们可以使用 `ctr -n k8s.io` 来查看 Kubernetes 下面创建的容器

- ### 查看命名空间

  ```sh
  ctr ns ls
  ```

  ![image-20231015235354973](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015235354973-1697385275542-3.png)

- ### 创建命名空间

  `create`可以简写成`c`

  ```sh
  ctr ns create tianch
  ```

  ![image-20231015235539993](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015235539993.png)

- ### 删除命名空间

  `remove`可以简写成`rm`

  ```sh
  ctr ns remove tianch
  ```

  ![image-20231015235800678](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015235800678.png)

- ### 指定命名空间

  ```sh
  ctr -n default image ls -q
  ```

  ![image-20231015235944352](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231015235944352.png)

