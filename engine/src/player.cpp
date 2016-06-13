#include <vector>
#include <iostream>
#include "player.hpp"

using namespace std;

Player::Player(string playerID):
    id(playerID)
{
    // cerr << "my player id " << id << " playerCount " << playerCount << endl;
}

Player::~Player(){

}
