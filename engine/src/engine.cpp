#include <queue>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <boost/array.hpp>
#include <boost/bind.hpp>
#include <boost/asio.hpp>
#include "inputmsg.hpp"

#if defined(BOOST_ASIO_HAS_POSIX_STREAM_DESCRIPTOR)

using boost::asio::ip::tcp;
namespace posix = boost::asio::posix;
using namespace std;

class Game {
public:
    Game(boost::asio::io_service& io_service)
        : input(io_service, ::dup(STDIN_FILENO)),
          output(io_service, ::dup(STDOUT_FILENO)),
          inputbuf(InputMsg::max_length){

        async_read_input();

    }

    ~Game(){
        close();
    }

private:

    posix::stream_descriptor input;
    posix::stream_descriptor output;
    boost::asio::streambuf inputbuf;
    InputMsg inputmsg;
    queue<string> msgs;

    void async_read_input(){
        boost::asio::async_read_until(input, inputbuf, '\n',
                                      boost::bind(&Game::handle_read_input, this,
                                                  boost::asio::placeholders::error,
                                                  boost::asio::placeholders::bytes_transferred));
    }

    int count = 0; // mach

    void handle_read_input(const boost::system::error_code& error,
                           std::size_t length){
        if (!error){
            inputbuf.sgetn(inputmsg.getBuf(), length - 1);
            inputbuf.consume(1); // Remove newline from input.
            inputmsg.push(length - 1);
            msgs.push(inputmsg.getData());
            inputmsg.flush();
            async_read_input();

            // mach
            if (count++ % 4 == 0){
                while (!msgs.empty()){
                    cout << "you sent: " << msgs.front() << endl;
                    msgs.pop();
                }
            }

            // mach ref
            // static char eol[] = { '\n' };
            // boost::array<boost::asio::const_buffer, 2> buffers = {{
            //         boost::asio::buffer(inputmsg.getData(), strlen(inputmsg.getData())),
            //         boost::asio::buffer(eol)
            //     }};
            // boost::asio::async_write(output, buffers,
            //                          boost::bind(&Game::handle_write_output, this,
            //                                      boost::asio::placeholders::error));

        } else if (error == boost::asio::error::not_found){ // Didn't get a newline
            inputbuf.sgetn(inputmsg.getBuf(), InputMsg::max_length);
            inputmsg.push(InputMsg::max_length);
            async_read_input();
        } else { // mach restart stdin and stdout if er
            close();
            throw error.message();
        }
    }

    void handle_write_output(const boost::system::error_code& error){
        async_read_input();
    }

    void close(){
        try {
            input.close();
            output.close();
        } catch (std::exception& e){

        }
    }

};

int main(int argc, char* argv[]){
    try {
        if (argc != 1){
            std::cerr << "Usage: engine\n";
            return 1;
        }
        boost::asio::io_service io_service;
        Game game(io_service);
        io_service.run();
    } catch (std::exception& e){
        std::cerr << "Exception: " << e.what() << "\n";
    }
    return 0;
}

#else // defined(BOOST_ASIO_HAS_POSIX_STREAM_DESCRIPTOR)
int main() {}
#endif // defined(BOOST_ASIO_HAS_POSIX_STREAM_DESCRIPTOR)
