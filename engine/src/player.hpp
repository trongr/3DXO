#ifndef PLAYER_HPP
#define PLAYER_HPP

class Player {
public:

    Player();

    ~Player();
    int getID() const { return id; }

private:

    static int curID; // increasing unit ID

    int id;

};

#endif // PLAYER_HPP
