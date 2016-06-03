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
        : _input(io_service, ::dup(STDIN_FILENO)),
          _output(io_service, ::dup(STDOUT_FILENO)),
          _input_buffer(InputMsg::max_length){

        async_read_input();

    }

    ~Game(){
        close();
    }

private:

    posix::stream_descriptor _input;
    posix::stream_descriptor _output;
    boost::asio::streambuf _input_buffer;
    InputMsg _input_msg;
    queue<string> _msgs;

    void async_read_input(){
        boost::asio::async_read_until(_input, _input_buffer, '\n',
                                      boost::bind(&Game::handle_read_input, this,
                                                  boost::asio::placeholders::error,
                                                  boost::asio::placeholders::bytes_transferred));
    }

    void handle_read_input(const boost::system::error_code& error,
                           std::size_t length){
        if (!error){
            _input_buffer.sgetn(_input_msg.buf(), length - 1);
            _input_buffer.consume(1); // Remove newline from input.
            _input_msg.push(length - 1);
            _msgs.push(_input_msg.data());
            _input_msg.flush();
            async_read_input();

            // mach ref
            // static char eol[] = { '\n' };
            // boost::array<boost::asio::const_buffer, 2> buffers = {{
            //         boost::asio::buffer(_input_msg.data(), strlen(_input_msg.data())),
            //         boost::asio::buffer(eol)
            //     }};
            // boost::asio::async_write(_output, buffers,
            //                          boost::bind(&Game::handle_write_output, this,
            //                                      boost::asio::placeholders::error));

        } else if (error == boost::asio::error::not_found){ // Didn't get a newline
            _input_buffer.sgetn(_input_msg.buf(), InputMsg::max_length);
            _input_msg.push(InputMsg::max_length);
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
            _input.close();
            _output.close();
        } catch (std::exception& e){

        }
    }

};

int main(int argc, char* argv[]){
    try {
        if (argc != 1){
            std::cerr << "Usage: game\n";
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
