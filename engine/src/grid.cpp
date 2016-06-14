#include <iostream>
#include "PoissonGenerator.h"
#include "grid.hpp"

using namespace std;

Grid::Grid():
    unitCount(0),
    grid(WIDTH, vector<Tile>(WIDTH))
{
    makeTiles();
    makePlayerPositions();
}

Grid::~Grid(){

}

void Grid::printTiles(){
    for (int i = 0; i < WIDTH; i++){
        for (int j = 0; j < WIDTH; j++){
            Tile& t = grid.at(i).at(j);
            if (t.isEmpty()){
                cerr << ".";
            } else {
                cerr << Unit::TypeStrings[t.getUnit()->getType()];
                // cerr << "unit type: " << Unit::TypeStrings[t.getUnit()->getType()]
                //      << " unitID " << t.getUnit()->getID() << endl;
            }
        }
        cerr << "\n";
    }
}

bool Grid::makeArmy(std::string playerID){
    if (playerPositions.empty()){
        cerr << "ERROR. Grid.makeArmy: no more positions. TODO: generate more positions\n";
        return false;
    }
    vector<int> xy = playerPositions.back();
    playerPositions.pop_back();
    int x = xy.at(0);
    int y = xy.at(1);
    makeUnit(playerID, Unit::KING, {x, y, 0});
    // for (auto &pp : playerPositions){
    //     cerr << "what's going on " << pp[0] << " " << pp[1] << std::endl;
    // }
    return true;
}

void Grid::makeTiles(){
    for (int i = 0; i < WIDTH; i++){
        for (int j = 0; j < WIDTH; j++){
            grid[i][j] = Tile({i, j, 0});
        }
    }
}

void Grid::makePlayerPositions(){
    // PoissonGenerator's NumPoints isn't exact: roughly NumPoints *
    // pi / 4, so we prefill twice as many player positions, just in
    // case:
    int NumPoints = 2.0 * MAX_PLAYERS * 4.0 / 3.14;
    PoissonGenerator::DefaultPRNG PRNG;
    const auto Points = PoissonGenerator::GeneratePoissonPoints( NumPoints, PRNG );
    for ( auto i = Points.begin(); i != Points.end(); i++ ){
        if (i->x >= 1 || i->y >= 1 ||
            i->x <  0 || i->y <  0){
            cerr << "ERROR. Grid.makePlayerPositions: PoissonGenerator out of bounds\n";
            continue;
        }
        int x = int( i->x * WIDTH );
        int y = int( i->y * WIDTH );
        playerPositions.push_back({x, y});
    }
}

bool Grid::makeUnit(std::string playerID, Unit::Type type, vector<int> xyz){
    std::shared_ptr<Unit> u(new Unit(unitCount++, playerID, type, xyz));
    unitIndex.emplace(u->getID(), u);
    Tile& t = grid.at(xyz[0]).at(xyz[1]);
    if (t.isEmpty()){
        t.setUnit(u);
        return true;
    } else {
        return false;
    }
}
