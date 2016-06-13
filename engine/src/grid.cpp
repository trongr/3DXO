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

// mach
void Grid::makeArmy(std::string playerID){
    // makeUnit(playerID, Unit::PAWN, {0, 0, 0});
    // makeUnit(playerID, Unit::PAWN, {0, 1, 0});
    // makeUnit(playerID, Unit::PAWN, {0, 2, 0});
    if (playerPositions.empty()){
        cerr << "ERROR. grid.makeArmy: no more positions. TODO: generate more positions\n";
        return;
    }
    vector<int> xy = playerPositions.back();
    playerPositions.pop_back();
    int x = xy.at(0);
    int y = xy.at(1);
    cerr << "making army:" << x << " " << y << endl;
    // for (auto &pp : playerPositions){
    //     cerr << "what's going on " << pp[0] << " " << pp[1] << std::endl;
    // }
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
    // pi / 4, so we prefill extra player positions, just in case
    int NumPoints = 10 * 3;
	PoissonGenerator::DefaultPRNG PRNG;
	const auto Points = PoissonGenerator::GeneratePoissonPoints( NumPoints, PRNG );
	for ( auto i = Points.begin(); i != Points.end(); i++ ){
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
