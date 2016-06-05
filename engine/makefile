CC = g++
CFLAGS = -g -Wall -std=c++11
INCLUDES = -I$(HOME)/include
LFLAGS = -L$(HOME)/lib
LIBS = -lboost_system -lboost_thread -lpthread
MAIN = engine
DEPS =
SRCS = $(wildcard src/*.cpp)
OBJS = $(patsubst src/%.cpp,obj/%.o,$(SRCS))

$(MAIN): build $(OBJS) $(DEPS)
	$(CC) -o $@ $(OBJS) $(CFLAGS) $(INCLUDES) $(LFLAGS) $(LIBS)

obj/%.o: src/%.cpp
	$(CC) -c -o $@ $< $(CFLAGS) $(INCLUDES)

build:
	@mkdir -p obj

.PHONY: clean
clean:
	rm -rf $(MAIN) obj *~
