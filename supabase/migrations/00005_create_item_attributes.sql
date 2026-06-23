CREATE TABLE item_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  attribute_name text NOT NULL,
  attribute_value text NOT NULL,
  order_index integer NOT NULL DEFAULT 0
);

CREATE INDEX item_attributes_item_id_idx ON item_attributes (item_id);
