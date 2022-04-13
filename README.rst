===============
Warre Dashboard
===============


Horizon panels for Warre

Features
--------

* Please see warre repository


Howto
-----

1. Package the warre_dashboard by running::

    python setup.py sdist

   This will create a python egg in the dist folder, which can be used to
   install on the horizon machine or within horizon's python virtual
   environment.

2. Copy ``_1500_project_reservations_panel.py`` in
   ``warre_dashboard/enabled`` directory
   to ``openstack_dashboard/local/enabled``::

    $ cp -a \
      ${WARRE_DASHBOARD_DIR}/warre_dashboard/enabled/_15*.py \
      ${HORIZON_DIR}/openstack_dashboard/local/enabled/

3. (Optional) Generate the policy file and copy into horizon's policy files
   folder, and copy ``_1599_warre.py`` in
   ``warre_dashboard/local_settings.d`` directory
   to ``openstack_dashboard/local/local_settings.d``::

    $ oslopolicy-policy-generator \
      --config-file \
      ${WARRE_DIR}/etc/policy/warre-policy-generator.conf \
      --output-file \
      ${WARRE_DASHBOARD_DIR}/warre_dashboard/conf/warre_policy.yaml
    $ cp -a \
      ${WARRE_DASHBOARD_DIR}/warre_dashboard/conf/warre_policy.yaml \
      ${HORIZON_DIR}/openstack_dashboard/conf/
    $ cp -a \
      ${WARRE_DASHBOARD_DIR}/warre_dashboard/local_settings.d/_1599_*.py \
      ${HORIZON_DIR}/openstack_dashboard/local/local_settings.d/

4. Django has a compressor feature that performs many enhancements for the
   delivery of static files. If the compressor feature is enabled in your
   environment (``COMPRESS_OFFLINE = True``), run the following commands::

    $ ./manage.py collectstatic
    $ ./manage.py compress

5. Finally restart your web server to enable warre-dashboard
   in your Horizon::

    $ sudo service apache2 restart
