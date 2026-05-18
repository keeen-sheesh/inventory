<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AddBunsRecipe extends Command
{
    protected $signature = 'recipe:add-buns';
    protected $description = 'Add Buns to Burger recipe';

    public function handle()
    {
        $burger = \App\Models\Item::where('name', 'like', '%Burger%')->first();
        $buns = \App\Models\Ingredient::where('name', 'like', '%Buns%')->first();

        if ($burger && $buns) {
            $this->info("Adding Buns to Burger recipe...");
            
            $exists = DB::table('item_ingredients')
                ->where('item_id', $burger->id)
                ->where('ingredient_id', $buns->id)
                ->exists();
            
            if ($exists) {
                $this->info("Buns already in recipe!");
            } else {
                DB::table('item_ingredients')->insert([
                    'item_id' => $burger->id,
                    'ingredient_id' => $buns->id,
                    'quantity_required' => 1,
                    'unit' => 'piece',
                    'notes' => '[portion:both]',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $burger->update(['has_recipe' => true]);
                $this->info("Done! Added 1 piece of Buns to Burger recipe.");
            }
        } else {
            $this->error("Burger or Buns not found");
        }

        return 0;
    }
}
