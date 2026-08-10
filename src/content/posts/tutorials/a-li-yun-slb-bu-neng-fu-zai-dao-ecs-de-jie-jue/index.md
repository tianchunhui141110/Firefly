---
title: "阿里云SLB不能负载到ECS的解决"
published: 2021-06-24
description: "新加的机器ECS,通过SLB居然负载不上去,网上百度了很多方法,甚至还求助了阿里云内部工作人员,无果.最后想到之前申请的机器都会执行一个脚本,修改一些配置.之后搜索了一些相关文章,发现了其中的问题."
tags: ["运维"]
category: "其他"
draft: false
lang: zh_CN
---

新加的机器ECS,通过SLB居然负载不上去,网上百度了很多方法,甚至还求助了阿里云内部工作人员,无果.最后想到之前申请的机器都会执行一个脚本,修改一些配置.之后搜索了一些相关文章,发现了其中的问题.

`对于添加到负载均衡实例后端的ECS，原则上不需要进行特别的配置。如果针对关联到负载均衡4层（TCP协议）服务的Linux系统的ECS，如果发现无法正常访问，需要确保系统配置文件/etc/sysctl.conf的以下三项为0`

```shell
net.ipv4.conf.default.rp_filter = 0
net.ipv4.conf.all.rp_filter = 0
net.ipv4.conf.eth0.rp_filter = 0
```

`如果部署在同一内网网段下的ECS之间有通信需求，且发现有无法通信的情况存在，那么需要检查如下参数的配置是否正确`

```shell
net.ipv4.conf.default.arp_announce =2
net.ipv4.conf.all.arp_announce =2
```

- 更新配置

```shell
sysctl -p
```

- 脚本分享

  ```sh
  #######main

  #install tools
  install_tools()
  {
  echo -e "\033[32m \037Begin install tools,please waiting........\033[0m"

  yum install -y setuptool vim wget ntp ftp telnet openssh-clients make dstat ncurses-devel gcc gcc-c++ make libtool lrzsz >/dev/null 2>&1

  if [ $? -eq 0 ];then
  	echo -e "\033[32m \037The tools install finshed...\033[0m"
  fi
  }

  selinux()
  {
  #being selinux config
  SELINUX_STATUS=`cat /etc/selinux/config  |grep '^SELINUX\>' |cut -d "=" -f2`
  if [[ $SELINUX_STATUS == enforcing || $SELINUX_STATUS == permissive ]];then
  	sed -i "s/SELINUX=$SELINUX_STATUS/SELINUX=disabled/g" /etc/selinux/config
    	echo -e "Now selinux status is: \033[1;31m disable\033[0m."
  else
    	echo -e "No change.The selinux status is: \033[1;35m disable\033[0m."
  fi
  }

  Time()
  {
  #time zone
  TIME_ZONE=`cat /etc/sysconfig/clock |grep '^ZONE' |cut -d "=" -f2`
  if [ $TIME_ZONE != \"Asia/Shanghai\" ];then
  cat > /etc/sysconfig/clock <<EOF
  ZONE="Asia/Shanghai"
  UTC=false
  ARC=false
  EOF

  	TIME_ZONE=`cat /etc/sysconfig/clock |grep '^ZONE' |cut -d "=" -f2`
  	echo -e "Now Time zone set success ,Zone now is: \"\033[1;31m$TIME_ZONE\033[0m\"."
  else
    	echo -e "No change.Time zone is: \"\033[1;35m$TIME_ZONE\033[0m\"."
  fi

  }

  ##time sync
  time_sync()
  {
  time_dns='pool.ntp.org'
  /usr/sbin/ntpdate  -s $time_dns
  TIME=`date +%Y-%m-%d_%T`
  export LANG=C
  if [ $? -eq 0 ];then
  	echo -e "Sync time success.Now the time is: \"\033[1;32m$TIME\033[0m\""
  fi
  #sync time for bios
  hwclock --systohc

  }

  ssh_port()
  {
  #change ssh login port
  DE_SH=`cat /etc/ssh/sshd_config |grep 'Port\>' |head -c1`
  DE_SH_PORT=`cat /etc/ssh/sshd_config |grep 'Port\>'`
  if [ $DE_SH == \# ];then
  	sed -i s/"$DE_SH_PORT"/"Port 3322"/ /etc/ssh/sshd_config
  	SSH_PORT=`cat /etc/ssh/sshd_config |grep 'Port\>' |awk '{print $2}'`
  	if [ $SSH_PORT == 3322 ];then
  		echo -e "Now SSH port set success,port is: \"\033[1;31m$SSH_PORT\033[0m.\""
  	fi
  else
    	SSH_PORT=`cat /etc/ssh/sshd_config |grep 'Port\>' |awk '{print $2}'`
    	if [ $SSH_PORT != 3322 ];then
      		sed -i s/"Port $SSH_PORT"/"Port 3322"/ /etc/ssh/sshd_config
      		echo -e "Now SSH port \"\033[1;31m$SSH_PORT\033[0m\" has change \"\033[1;31m63999\033[0m\"."
    	else
    		echo -e "No change SSH port is: \"\033[1;35m63999\033[0m\""
    	fi
  fi
  }

  ssh_root()
  {
  #delay root login
  DEF_PER=`cat /etc/ssh/sshd_config |grep 'PermitRootLogin'   |grep -v 'without-password' |head -c 1`
  DEF_PER_CON=`cat /etc/ssh/sshd_config |grep 'PermitRootLogin'   |grep -v 'without-password'`
  if [ $DEF_PER == \# ];then
  	sed -i s/"$DEF_PER_CON"/"PermitRootLogin no"/ /etc/ssh/sshd_config
    	DEF_PER_CON1=`cat /etc/ssh/sshd_config |grep 'PermitRootLogin'   |grep -v 'without-password'`
    	echo -e "Now Root login permit set success.Now is: \"\033[1;31m$DEF_PER_CON1\033[0m\" ."
  else
    	LOGIN_PER=`cat /etc/ssh/sshd_config |grep 'PermitRootLogin'   |grep -v 'without-password' |cut -d" " -f2`
    	if [ $LOGIN_PER == yes ];then
     		sed -i s/"PermitRootLogin yes"/"PermitRootLogin no"/ /etc/ssh/sshd_config
     		DEF_PER_CON2=`cat /etc/ssh/sshd_config |grep 'PermitRootLogin'   |grep -v 'without-password'`
     		echo -e "Now The permit is: \"\033[1;31m$DEF_PER_CON2\033[0m\" ."
    	else
     		echo -e "No change.The root login permit is: \"\033[1;35m no\033[0m\"."
    	fi
  fi
  }

  ssh_zip()
  {
  #open ssh zip
  DEF_ZIP=`cat /etc/ssh/sshd_config |grep Compression  |head -c 1`
  ZIP_STAT=`cat /etc/ssh/sshd_config |grep 'Compression'`
  if [ $DEF_ZIP == \# ];then
  	sed -i s/"$ZIP_STAT"/"Compression yes"/  /etc/ssh/sshd_config
  	ZIP_STAT=`cat /etc/ssh/sshd_config |grep 'Compression'`
  	echo -e "Open zip for scp success.status is: \"\033[1;31m$ZIP_STAT\033[0m.\""
  else
  	ZIP_STATUS=`cat /etc/ssh/sshd_config |grep 'Compression' |awk '{print $2}'`
  	if [ $ZIP_STATUS != yes ];then
  	 	sed -i s/"Compression $ZIP_STATUS"/"Compression yes"/  /etc/ssh/sshd_config
  		echo -e "Scp zip status: \"\033[1;31m$ZIP_STATUS\033[0m\" has change \"\033[1;31myes\033[0m\"."
  	else
  		echo -e "No change scp commpression status: \"\033[1;35myes\033[0m\""
  	fi
  fi
  }

  ssh_dns()
  {
  #close dns for ssh con
  DEF_DNS=`cat /etc/ssh/sshd_config |grep 'UseDNS' |head -c 1`
  DNS_STAT=`cat /etc/ssh/sshd_config |grep 'UseDNS'`
  if [ $DEF_DNS == \# ];then
  	sed -i s/"$DNS_STAT"/"UseDNS no"/  /etc/ssh/sshd_config
  	DNS_STAT=`cat /etc/ssh/sshd_config |grep 'UseDNS'`
  	echo -e "Close dns for ssh.status is: \"\033[1;31m$DNS_STAT\033[0m.\""
  else
  	DNS_STATUS=`cat /etc/ssh/sshd_config |grep 'UseDNS' |awk '{print $2}'`
  	if [ $ZIP_STATUS != no ];then
  	 	sed -i s/"Compression $ZIP_STATUS"/"Compression no"/  /etc/ssh/sshd_config
  		echo -e "DNS status: \"\033[1;31m$DNS_STATUS\033[0m\" has change \"\033[1;31mno\033[0m\"."
  	else
  		echo -e "No change UseDNS status: \"\033[1;35mno\033[0m\""
  	fi
  fi
  }

  ssh_startup()
  {
  #max start
  START_MAX=`cat /etc/ssh/sshd_config |grep MaxStartups |head -c 1`
  MAX_STAT=`cat /etc/ssh/sshd_config |grep MaxStartups`
  if [ $DEF_DNS == \# ];then
  	sed -i s/"$MAX_STAT"/"MaxStartups 5"/  /etc/ssh/sshd_config
  	MAX_STAT=`cat /etc/ssh/sshd_config |grep MaxStartups`
  	echo -e "The max startups status is : \"\033[1;31m$MAX_STAT\033[0m.\""
  fi
  }

  ssh_emptypasswd()
  {
  #refuse empty passwd login
  DEF_EMPTY=`cat /etc/ssh/sshd_config |grep PermitEmptyPasswords |head -c 1`
  EMPTY_STAT=`cat /etc/ssh/sshd_config |grep PermitEmptyPasswords`
  if [ $DEF_EMPTY == \# ];then
  	sed -i s/"$EMPTY_STAT"/"PermitEmptyPasswords no"/  /etc/ssh/sshd_config
  	EMPTY_STAT=`cat /etc/ssh/sshd_config |grep PermitEmptyPasswords`
  	echo -e "PermitEmptyPasswords status is: \"\033[1;31m$EMPTY_STAT\033[0m.\""
  else
  	EMPTY_STATUS=`cat /etc/ssh/sshd_config |grep 'PermitEmptyPasswords' |awk '{print $2}'`
  	if [ $EMPTY_STATUS != no ];then
  	 	sed -i s/"PermitEmptyPasswords $EMPTY"/"PermitEmptyPasswords no"/  /etc/ssh/sshd_config
  		echo -e "PermitEmptyPasswords status: \"\033[1;31m$EMPTY_STATUS\033[0m\" has change \"\033[1;31mno\033[0m\"."
  	else
  		echo -e "No change PermitEmptyPasswords status: \"\033[1;35mno\033[0m\""
  	fi
  fi

  }

  ssh_restart()
  {
  echo -e "\033[1;32m Begin restart sshd process....\033[0m"
  systemctl restart sshd.service >/dev/null
  if [ $? -eq 0 ];then
  	echo -e "\033[1;31m sshd_config set success. \033[0m"
  fi

  }

  set_user()
  {
  #beging set user
  NAME_COU=`cat /etc/passwd |grep '^test\>' |wc -l`
  if [ $NAME_COU -eq 1 ];then
    	echo 'test123' | passwd --stdin "test" > /dev/null
    	echo -e "No change . The user name \"\033[1;35m test\033[0m \" exist,passwd has set again. please check out."
  else
   	useradd test
   	echo 'test123' | passwd --stdin "test" > /dev/null
   	echo -e "Now Create username \"\033[1;31m test \033[0m\" && set passwd success."
  fi

  #set root passwd
  echo 'testroot' | passwd --stdin "root" > /dev/null
  echo -e "Now \033[1;31m Root\033[0m passwd set success.."

  }

  profile_hist()
  {
  #begin set add time format for history
  PRO_COUNT=`cat /etc/profile |grep 'HISTTIMEFORMAT' |wc -l`
  if [ $PRO_COUNT -eq 0 ];then
    	/bin/sed -i "/^export PATH/a\export HISTTIMEFORMAT" /etc/profile
    	/bin/sed -i "/^HISTSIZE/a\HISTTIMEFORMAT=\"%Y-%m-%d %H:%M:%S: \"" /etc/profile
    	export HISTTIMEFORMAT
    	echo -e "Now The\033[1;31m history timeformat\033[0m set success now."
  else
    	echo -e "No change.The\033[1;35m history timeformat\033[0m has setted ."
  fi
  }

  profile_other()
  {
  echo "TMOUT=1800" >> /etc/profile
  echo "alias vi='vim'" >>/etc/profile
  echo "unset MAILCHECK" >> /etc/profile
  source /etc/profile
  }

  run_level()
  {
  #begin set runlevel
  RUNLEVEL=`cat /etc/inittab |grep '^id:.:initdefaul' |cut -d":" -f2`
  if [ $RUNLEVEL != 3 ];then
    	/bin/sed -i  s/"id:$RUNLEVEL"/"id:3"/ /etc/inittab
    	NOW_RUNLEVEL=`cat /etc/inittab |grep '^id:.:initdefaul' |cut -d":" -f2`
    	echo -e "Now the runlevel is \"\033[1;31m$NOW_RUNLEVEL\033[0m\"."
  else
    	echo -e "No change .The runlevel is \"\033[1;35m$RUNLEVEL\033[0m\"."
  fi
  }

  iptables()
  {
  ##begin set iptables start levle
  systemctl disable  firewalld.service > /dev/null
  echo -e "Now default \033[1;31m iptables\033[0m start runlevel all set off "
  systemctl stop firewalld.service > /dev/null
  }

  unnecessary_service()
  {
  #begin turn off unnecessary services
  export LANG=C
  echo -e "\e[32m begin turn off unnecessary services.....\e[0m"
  for close_list in `chkconfig --list |awk '($5~/on/ || $7~/on/) {print $1}' | grep -vE "atd|crond|cpuspeed|irqbalance|lvm2-monitor|network|smartd|sshd|syslog|sysstat"`
  do
  	echo $close_list
  	/sbin/chkconfig --level 2345 $close_list off
  	/sbin/service $close_list stop >/dev/null
  done
  echo -e "Now The \033[1;31m unnecessary services \033[0m turn off now."
  #echo -e "\e[32m----------------End  system initialization ---------------\e[0m"
  }

  ##set sysctl.conf

  sysctl_set()
  {
  cat >> /etc/sysctl.conf <<EOF
  ###################################################
  vm.overcommit_memory = 1
  ###################################################
  net.netfilter.nf_conntrack_max=1000000
  ###################################################
  net.core.rmem_default = 126976
  net.core.wmem_default = 126976
  net.core.wmem_max = 16777216
  net.core.rmem_max = 16777216
  net.ipv4.tcp_mem = 8192 87380 16777216
  net.ipv4.tcp_wmem = 8192 65536 16777216
  net.ipv4.tcp_rmem = 8192 87380 16777216
  ###################################################
  net.core.netdev_max_backlog = 2500
  net.core.somaxconn = 100000
  ###################################################
  net.ipv4.tcp_no_metrics_save = 0
  net.ipv4.tcp_moderate_rcvbuf = 1
  net.ipv4.tcp_orphan_retries= 1
  net.ipv4.tcp_fin_timeout = 5
  net.ipv4.tcp_keepalive_time = 300
  net.ipv4.tcp_syncookies = 1
  net.ipv4.tcp_sack = 1
  net.ipv4.tcp_tw_reuse = 1
  net.ipv4.tcp_tw_recycle = 1
  net.ipv4.ip_local_port_range = 10250 65000
  net.ipv4.tcp_max_syn_backlog = 81920
  net.ipv4.tcp_max_tw_buckets = 1600000
  net.ipv4.tcp_synack_retries = 2
  net.ipv4.tcp_syn_retries = 2
  net.ipv4.tcp_retries2 = 2
  net.ipv4.tcp_window_scaling = 1
  net.ipv4.tcp_timestamps = 1
  ###################################################
  fs.file-max = 1024000
  EOF

  sysctl -p >/dev/null 2>1&

  }

  #limit file
  limit_file()
  {
  cat >> /etc/security/limits.conf <<EOF
  *                hard    nofile         1024000
  *                soft    nofile         1024000
  *                hard    nproc          1024000
  *                soft    nproc          1024000
  EOF
  }

  sudu_log()
  {
  touch /var/log/sudo.log
  cat >> /etc/sudoers <<EOF
  LocoJoyUser    ALL=(ALL)       NOPASSWD: /bin/sh
  Defaults logfile=/var/log/sudo.log
  EOF

  cat >> /etc/rsyslog.conf <<EOF
  local8.debug    /var/log/sudo.log
  EOF
  }

  echo -e "\e[32m----------------Begin  system initialization ---------------\e[0m"
  echo
  install_tools
  selinux
  #Time
  time_sync
  ssh_port
  ssh_root
  ssh_zip
  ssh_dns
  ssh_startup
  ssh_emptypasswd
  ssh_restart
  set_user
  profile_hist
  profile_other
  #run_level
  iptables
  #unnecessary_service
  sysctl_set
  limit_file
  sudu_log
  echo
  echo -e "\e[32m----------------End  system initialization ---------------\e[0m"
  ```

