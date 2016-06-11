#define NDEBUG

#include <queue>
#include <cstdlib>
#include <string>
#include <iostream>
#include <unordered_map>
#include <boost/array.hpp>
#include <boost/bind.hpp>
#include <boost/asio.hpp>
#include <boost/date_time/posix_time/posix_time.hpp>
#include "rapidjson/document.h"
#include "rapidjson/writer.h"
#include "rapidjson/stringbuffer.h"
#include "inputmsg.hpp"
#include "grid.hpp"
#include "player.hpp"

#if defined(BOOST_ASIO_HAS_POSIX_STREAM_DESCRIPTOR)

namespace posix = boost::asio::posix;
using namespace rapidjson;
using namespace std;

class Game {
public:
    Game(boost::asio::io_service& io_service)
        : io_service(io_service),
        timer(io_service, boost::posix_time::millisec(UPDATE_INTERVAL)),
        input(io_service, ::dup(STDIN_FILENO)),
        output(io_service, ::dup(STDOUT_FILENO)),
        inputbuf(InputMsg::max_length){

        async_read_input();
        loop();
    }

    ~Game(){
        close();
    }

private:

    const int UPDATE_INTERVAL = 250; // game loop period in ms

    boost::asio::io_service& io_service;
    boost::asio::deadline_timer timer;
    posix::stream_descriptor input;
    posix::stream_descriptor output;
    boost::asio::streambuf inputbuf;
    InputMsg inputmsg;
    queue<string> msgs;
    Grid grid;
    std::unordered_map<int, Player> players;

    void loop(){
        timer.async_wait(boost::bind(&Game::update, this));
    }

    void update(){
        while (!msgs.empty()){
            string s = msgs.front();
            msgs.pop();
            processInput(s);
            // StringBuffer buffer;
            // Writer<StringBuffer> writer(buffer);
            // d.Accept(writer);
            // std::cout << buffer.GetString() << std::endl;
        }
        timer.expires_at(timer.expires_at() + boost::posix_time::millisec(UPDATE_INTERVAL));
        timer.async_wait(boost::bind(&Game::update, this));
    }

    void async_read_input(){
        boost::asio::async_read_until(input, inputbuf, '\n',
                                      boost::bind(&Game::handle_read_input, this,
                                                  boost::asio::placeholders::error,
                                                  boost::asio::placeholders::bytes_transferred));
    }

    void handle_read_input(const boost::system::error_code& error,
                           std::size_t length){
        if (!error){
            inputbuf.sgetn(inputmsg.getBuf(), length - 1);
            inputbuf.consume(1); // Remove newline from input.
            inputmsg.push(length - 1);
            msgs.push(inputmsg.getData());
            inputmsg.flush();
            async_read_input();

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

    void processInput(string s){
        Document d;
        if (d.Parse(s.c_str()).HasParseError()){
            cerr << "ERROR. engine.processInput.rapidjson.zero: " << s << endl;
            return;
        }

        if (!d.HasMember("method")){
            cerr << "ERROR. engine.processInput.rapidjson.one: " << s << endl;
            return;
        }
        string method = d["method"].GetString();

        if (method == "makeplayer") makePlayer();
        else if (method == "getzone") getZone(d);

        // {
        //     const Value& data = d["data"];
        //     if (!data.IsArray()){
        //         cerr << "ERROR. engine.processInput.rapidjson.two: " << s << endl;
        //         return;
        //     }
        //     for (SizeType i = 0; i < data.Size(); i++){
        //         cout << "receiving data " << data[i].GetString() << endl;
        //     }
        // }

    }

    void makePlayer(){
        Player p = Player();
        int playerID = p.getID();
        players.emplace(playerID, p);
        // grid.makeArmy(playerID);
        // grid.printTiles();
    }

    void getZone(const rapidjson::Document& d){
        if (!d.HasMember("x") || !d.HasMember("y")){
            cerr << "ERROR. engine.getZone.rapidjson\n";
            return;
        }
        int x = d["x"].GetInt();
        int y = d["y"].GetInt();
        cerr << "getting zone " << x << " " << y << endl;
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
        std::cerr << "ERROR. engine.main: " << e.what() << "\n";
    }
    return 0;
}

#else // defined(BOOST_ASIO_HAS_POSIX_STREAM_DESCRIPTOR)
int main() {}
#endif // defined(BOOST_ASIO_HAS_POSIX_STREAM_DESCRIPTOR)
