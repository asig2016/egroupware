# Running EGroupware in Docker

## Quick instructions
```
curl https://raw.githubusercontent.com/EGroupware/egroupware/master/doc/docker/docker-compose.yml > docker-compose.yml
curl https://raw.githubusercontent.com/EGroupware/egroupware/master/doc/docker/nginx.conf > nginx.conf
# edit docker-compose.yml or nginx.conf, by default it will run on http://localhost:8080/
mkdir data # this is where egroupware data is stored, it's by default a subdir of the directory of docker-compose.yml
docker-compose up -d
```
## More information
The provided docker-compose.yml will run the following container:
* **egroupware** running latest PHP 7.3 as FPM (see fpm subdirectory for more information)
* **egroupware-nginx** running Nginx as webserver (by default http only on port 8080)
* **egroupware-db** latest MariaDB 10.4
* **egroupware-watchtower** updating all above container automatically daily at 4am
```
version: '3'
volumes:
  sources:
  db:
  data:
    driver_opts:
      type: none
      o: bind
      # to upgrade an existing non-docker installation most easy is to use the existing
      # data directory /var/lib/egroupware AND the host database see below
      #device: /var/lib/egroupware
      # otherwise data is stored in data subdirectory of the current directory
      device: $PWD/data
  # extra sources with apps not part of egroupware container
  #extra:
  #  driver_opts:
  #    type: none
  #    o: bind
  #    # location of deprecated EGroupware packages like Wiki, SiteMgr, KnowledgeBase
  #    device: /usr/share/egroupware
  #    #device: $PWD/extra
services:
  egroupware:
    image: egroupware/egroupware:latest
    # EPL image: download.egroupware.org/egroupware/epl:latest
    # setting a default language for a new installation
    #environment:
    #- LANG=de
    volumes:
    - sources:/usr/share/egroupware
    # extra-sources rsync from entry-point into sources
    #- extra:/usr/share/egroupware-extra
    - data:/var/lib/egroupware
    # if you want to use the host database:
    # 1. comment out the whole db service below AND
    # 2. set EGW_DB_HOST=localhost AND
    # 3. uncomment the next line and modify the host path (first one), it depends on your distro:
    #    - RHEL/CentOS   /var/lib/mysql/mysql.sock
    #    - openSUSE/SLE  /var/run/mysql/mysql.sock
    #    - Debian/Ubuntu /var/run/mysqld/mysqld.sock
    #- /var/run/mysqld/mysqld.sock:/var/run/mysqld/mysqld.sock
    environment:
    # MariaDB/MySQL host to use: for internal service use "db", for host database (socket bind-mounted into container) use "localhost"
    - EGW_DB_HOST=db
    # for internal db service you should to specify a root password here AND in db service
    # a database "egroupware" with a random password is created for you on installation (password is stored in header.inc.php in data directory)
    #- EGW_DB_ROOT=root
    - EGW_DB_ROOT_PW=secret
    # alternativly you can specify an already existing database with full right by the given user!
    #- EGW_DB_NAME=egroupware
    #- EGW_DB_USER=egroupware
    #- EGW_DB_PASS=
    # further post_install.php arguments can be passed as a single enviroment variable with space separated assignments
    # "<name1>=<value1> <name2>=<value2>" see https://github.com/EGroupware/egroupware/blob/master/doc/rpm-build/post_install.php#L17
    # to configure eg. LDAP for authentication and account storage use
    #- EGW_POST_INSTALL='account-auth=ldap,ldap ldap_base=ou=egroupware,dc=example,dc=org ldap_host=tls://ldap.example.org ldap_admin=cn=admin,$base ldap_admin_pw=secret ldap_context=cn=users,$base ldap_group_context=cn=groups,$base'
    restart: always
    depends_on:
    - db
    container_name: egroupware
    # set the ip-address of your docker host AND your official DNS name so EGroupware
    # can access Rocket.Chat or Collabora without the need to go over your firewall
    #extra_hosts:
    #- "my.host.name:ip-address"

  nginx:
    image: nginx:stable-alpine
    volumes:
    - sources:/usr/share/egroupware:ro
    # to add a certificate create a certificate.pem containing (in that order)
    # 1. private key
    # 2. public key
    # 3. (optional) chain certificates
    # uncomment to the next line
    # ./certificate.pem:/etc/ssl/private/certificate.pem
    # AND uncomment the three lines starting with "listen 443", "ssl_certificate", "ssl_certificate_key" in nginx.conf
    - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
    # if no webserver is running on the host, change (first) number to 80 or 443
    - "8080:80"
    - "4443:443"
    depends_on:
    - egroupware
    container_name: egroupware-nginx

  # run an own MariaDB:10.4 (you can use EGroupware's database backup and restore to add your existing database)
  db:
    image: mariadb
    environment:
    #- MYSQL_ROOT=root
    - MYSQL_ROOT_PASSWORD=secret
    volumes:
    - db:/var/lib/mysql
    container_name: egroupware-db

  # automatic updates of all containers daily at 4am
  # see https://containrrr.github.io/watchtower for more information
  watchtower:
    image: containrrr/watchtower
    volumes:
    - /var/run/docker.sock:/var/run/docker.sock
    # For automatic EPL Updates (not necessary for CE!) you need to pass docker
    # credentials into watchtower after running: docker login download.egroupware.org
    #- /root/.docker/config.json:/config.json:ro
    environment:
    - WATCHTOWER_CLEANUP=true # delete old image after update to not fill up the disk
    # for email notifications add your email and mail-server here
    #- WATCHTOWER_NOTIFICATIONS=email
    #- WATCHTOWER_NOTIFICATIONS_LEVEL=info # possible values: panic, fatal, error, warn, info or debug
    #- WATCHTOWER_NOTIFICATION_EMAIL_FROM="watchtower@my-domain.com"
    #- WATCHTOWER_NOTIFICATION_EMAIL_TO="me@my-domain.com"
    #- WATCHTOWER_NOTIFICATION_EMAIL_SERVER="mail.my-domain.com" # if you give your MX here, you need no user/password
    #- WATCHTOWER_NOTIFICATION_EMAIL_SERVER_PORT=25
    #- WATCHTOWER_NOTIFICATION_EMAIL_SERVER_USER="watchtower@my-domain.com"
    #- WATCHTOWER_NOTIFICATION_EMAIL_SERVER_PASSWORD="secret"
    command: --schedule "0 0 4 * * *"
    container_name: egroupware-watchtower
    restart: always
```
