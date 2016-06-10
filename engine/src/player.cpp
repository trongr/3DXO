#include <vector>
#include <iostream>
#include "player.hpp"

using namespace std;

int Player::curID = 0;

Player::Player():
    id(curID++)
{
    cerr << "my player id " << id << " curID " << curID << endl;
}

Player::~Player(){

}
