#ifndef PLAYER_HPP
#define PLAYER_HPP

#include <string>

class Player {
public:

    Player(std::string playerID);

    ~Player();
    std::string getID() const { return id; }

private:

    std::string id;

};

#endif // PLAYER_HPP
