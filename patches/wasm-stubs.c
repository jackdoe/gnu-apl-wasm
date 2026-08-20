#include <errno.h>
#include <semaphore.h>
#include <time.h>

int sem_timedwait(sem_t * sem, const struct timespec * abstime)
{
   (void)sem;
   (void)abstime;
   errno = ENOSYS;
   return -1;
}
