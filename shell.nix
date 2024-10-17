let
  inherit ((builtins.fromJSON (builtins.readFile ./flake.lock)).nodes.flake-compat.locked) rev narHash;
in
(import
  (fetchTarball { url = "https://github.com/edolstra/flake-compat/archive/${rev}.tar.gz"; sha256 = narHash; })
  { src = ./.; }).shellNix
