---
title: "FlexVolume"
published: 2026-01-05
description: "Kubernetes 默认情况下就提供了主流的存储卷接入方案，可以执行命令 kubectl explain pod.spec.volumes 查看到支持的各种存储卷，另外也提供了插件机制，允许其他类型的存储服务接入到 Kubernetes "
tags: ["Kubernetes"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

Kubernetes 默认情况下就提供了主流的存储卷接入方案，可以执行命令 `kubectl explain pod.spec.volumes` 查看到支持的各种存储卷，另外也提供了插件机制，允许其他类型的存储服务接入到 Kubernetes 系统中来，在 Kubernetes 中就对应 `In-Tree` 和 `Out-Of-Tree` 两种方式，`In-Tree` 就是在 Kubernetes 源码内部实现的，和 Kubernetes 一起发布、管理的，但是更新迭代慢、灵活性比较差，`Out-Of-Tree` 是独立于 Kubernetes 的，目前主要有 `CSI` 和 `FlexVolume` 两种机制，开发者可以根据自己的存储类型实现不同的存储插件接入到 Kubernetes 中去，其中 `CSI` 是现在也是以后主流的方式。



FlexVolume 提供了一种扩展 Kubernetes 存储插件的方式，用户可以自定义自己的存储插件。要使用 FlexVolume 需要在每个节点上安装存储插件二进制文件，该二进制需要实现 FlexVolume 的相关接口，默认存储插件的存放路径为 `/usr/libexec/kubernetes/kubelet-plugins/volume/exec/<vendor~driver>/<driver>`，`VolumePlugins` 组件会不断 watch 这个目录来实现插件的添加、删除等功能。

其中 `vendor~driver` 的名字需要和 Pod 中`flexVolume.driver` 的字段名字匹配，例如：

```shell
/usr/libexec/kubernetes/kubelet-plugins/volume/exec/foo~cifs/cifs
```

对应的 Pod 中的 `flexVolume.driver` 属性为：`foo/cifs`。

在实现自定义存储插件的时候，需要实现 FlexVolume 的部分接口，因为要看实际需求，并不一定所有接口都需要实现。比如对于类似于 NFS 这样的存储就没必要实现 `attach/detach` 这些接口了，因为不需要，只需要实现 `init/mount/umount` 3 个接口即可。

- init: `<driver executable> init` - `kubelet/kube-controller-manager` 初始化存储插件时调用，插件需要返回是否需要要 attach 和 detach 操作
- attach: `<driver executable> attach <json options> <node name>` - 将存储卷挂载到 Node 节点上
- detach: `<driver executable> detach <mount device> <node name>` - 将存储卷从 Node 上卸载
- waitforattach: `<driver executable> waitforattach <mount device> <json options>` - 等待 attach 操作成功（超时时间为 10 分钟）
- isattached: `<driver executable> isattached <json options> <node name>` - 检查存储卷是否已经挂载
- mountdevice: `<driver executable> mountdevice <mount dir> <mount device> <json options>` - 将设备挂载到指定目录中以便后续 bind mount 使用
- unmountdevice: `<driver executable> unmountdevice <mount device>` - 将设备取消挂载
- mount: `<driver executable> mount <mount dir> <json options>` - 将存储卷挂载到指定目录中
- unmount: `<driver executable> unmount <mount dir>` - 将存储卷取消挂载

实现上面的这些接口需要返回如下所示的 JSON 格式的数据：

```json
{
    "status": "<Success/Failure/Not supported>",
    "message": "<Reason for success/failure>",
    "device": "<Path to the device attached. This field is valid only for attach & waitforattach call-outs>"
    "volumeName": "<Cluster wide unique name of the volume. Valid only for getvolumename call-out>"
    "attached": <True/False (Return true if volume is attached on the node. Valid only for isattached call-out)>
    "capabilities": <Only included as part of the Init response>
    {
        "attach": <True/False (Return true if the driver implements attach and detach)>
    }
}
```

比如实现一个 NFS 的 FlexVolume 插件，最简单的方式就是写一个脚本，然后实现 init、mount、unmount 3 个命令即可，然后按照上面的 JSON 格式返回数据，最后把这个脚本放在节点的 FlexVolume 插件目录下面即可。

下面就是官方给出的一个 NFS 的 FlexVolume 插件示例，可以从 https://github.com/kubernetes/examples/blob/master/staging/volumes/flexvolume/nfs 获取脚本：

```sh
#!/bin/bash
# 注意:
#  - 在使用插件之前需要先安装 jq。
usage() {
    err "Invalid usage. Usage: "
    err "\t$0 init"
    err "\t$0 mount <mount dir> <json params>"
    err "\t$0 unmount <mount dir>"
    exit 1
}

err() {
    echo -ne $* 1>&2
}

log() {
    echo -ne $* >&1
}

ismounted() {
    MOUNT=`findmnt -n ${MNTPATH} 2>/dev/null | cut -d' ' -f1`
    if [ "${MOUNT}" == "${MNTPATH}" ]; then
        echo "1"
    else
        echo "0"
    fi
}

domount() {
    MNTPATH=$1

    NFS_SERVER=$(echo $2 | jq -r '.server')
    SHARE=$(echo $2 | jq -r '.share')

    if [ $(ismounted) -eq 1 ] ; then
        log '{"status": "Success"}'
        exit 0
    fi

    mkdir -p ${MNTPATH} &> /dev/null

    mount -t nfs ${NFS_SERVER}:/${SHARE} ${MNTPATH} &> /dev/null
    if [ $? -ne 0 ]; then
        err "{ \"status\": \"Failure\", \"message\": \"Failed to mount ${NFS_SERVER}:${SHARE} at ${MNTPATH}\"}"
        exit 1
    fi
    log '{"status": "Success"}'
    exit 0
}

unmount() {
    MNTPATH=$1
    if [ $(ismounted) -eq 0 ] ; then
        log '{"status": "Success"}'
        exit 0
    fi

    umount ${MNTPATH} &> /dev/null
    if [ $? -ne 0 ]; then
        err "{ \"status\": \"Failed\", \"message\": \"Failed to unmount volume at ${MNTPATH}\"}"
        exit 1
    fi

    log '{"status": "Success"}'
    exit 0
}

op=$1

if ! command -v jq >/dev/null 2>&1; then
    err "{ \"status\": \"Failure\", \"message\": \"'jq' binary not found. Please install jq package before using this driver\"}"
    exit 1
fi

if [ "$op" = "init" ]; then
    log '{"status": "Success", "capabilities": {"attach": false}}'
    exit 0
fi

if [ $# -lt 2 ]; then
    usage
fi

shift

case "$op" in
    mount)
        domount $*
        ;;
    unmount)
        unmount $*
        ;;
    *)
        log '{"status": "Not supported"}'
        exit 0
esac

exit 1
```

将上面脚本命名成 nfs，放置到 node1 节点对应的插件下面： `/usr/libexec/kubernetes/kubelet-plugins/volume/exec/tianch~nfs/nfs`，并设置权限为 700：

```shell
➜ chmod 700 /usr/libexec/kubernetes/kubelet-plugins/volume/exec/tianch~nfs/nfs
# 安装 jq 工具
➜ yum -y install https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
➜ yum install jq -y
```

这个时候我们部署一个应用到 node1 节点上，并用 `flexVolume` 来持久化容器中的数据（当然也可以通过定义 flexvolume 类型的 PV、PVC 来使用），如下所示：

